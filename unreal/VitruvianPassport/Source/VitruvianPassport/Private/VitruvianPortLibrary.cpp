#include "VitruvianPortLibrary.h"
#include "JsonObjectConverter.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"

bool UVitruvianPortLibrary::ParseAvatarPackage(const FString& Json, FVitruvianAvatar& OutAvatar, FString& OutError)
{
    OutAvatar = FVitruvianAvatar();
    TSharedPtr<FJsonObject> Root;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        OutError = TEXT("Not valid JSON");
        return false;
    }
    if (Root->GetStringField(TEXT("format")) != TEXT("faberland.avatar-package"))
    {
        OutError = TEXT("Not a faberland.avatar-package");
        return false;
    }
    OutAvatar.ProfileId = Root->GetStringField(TEXT("profileId"));
    OutAvatar.bSimulated = Root->GetBoolField(TEXT("simulated"));
    const TSharedPtr<FJsonObject>* Integrity = nullptr;
    if (Root->TryGetObjectField(TEXT("integrity"), Integrity)) OutAvatar.Digest = (*Integrity)->GetStringField(TEXT("digest"));

    const TSharedPtr<FJsonObject>* Unreal = nullptr;
    if (!Root->TryGetObjectField(TEXT("unreal"), Unreal) || !FJsonObjectConverter::JsonObjectToUStruct((*Unreal).ToSharedRef(), &OutAvatar.Passport, 0, 0))
    {
        OutError = TEXT("Missing or invalid 'unreal' section");
        return false;
    }

    const TSharedPtr<FJsonObject>* MH = nullptr;
    if (Root->TryGetObjectField(TEXT("metahuman"), MH))
    {
        const TSharedPtr<FJsonObject>* Base = nullptr;
        if ((*MH)->TryGetObjectField(TEXT("baseBody"), Base)) (*Base)->TryGetStringField(TEXT("preset"), OutAvatar.BaseBodyPreset);
        const TArray<TSharedPtr<FJsonValue>>* Seg = nullptr;
        if ((*MH)->TryGetArrayField(TEXT("skeleton"), Seg))
        {
            for (const TSharedPtr<FJsonValue>& V : *Seg)
            {
                const TSharedPtr<FJsonObject> O = V->AsObject();
                if (!O.IsValid()) continue;
                FVitruvianSkeletonSegment S;
                S.FromBone = FName(*O->GetStringField(TEXT("from")));
                S.ToBone = FName(*O->GetStringField(TEXT("to")));
                S.LengthCm = static_cast<float>(O->GetNumberField(TEXT("lengthCm")));
                OutAvatar.Skeleton.Add(S);
            }
        }
        const TSharedPtr<FJsonObject>* Skin = nullptr;
        const TArray<TSharedPtr<FJsonValue>>* Lin = nullptr;
        if ((*MH)->TryGetObjectField(TEXT("skin"), Skin) && (*Skin)->TryGetArrayField(TEXT("linear"), Lin) && Lin->Num() == 3)
        {
            OutAvatar.bHasSkin = true;
            OutAvatar.SkinLinear = FLinearColor((*Lin)[0]->AsNumber(), (*Lin)[1]->AsNumber(), (*Lin)[2]->AsNumber(), 1.f);
        }
    }
    if (OutAvatar.bSimulated) OutError = TEXT("Warning: simulated (emulator) data");
    return true;
}

static void SendGet(const FString& Url, const FString& AnonKey, const FString& Bearer, bool bRestRows, FOnVitruvianAvatar OnDone)
{
    const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req = FHttpModule::Get().CreateRequest();
    Req->SetURL(Url);
    Req->SetVerb(TEXT("GET"));
    Req->SetHeader(TEXT("apikey"), AnonKey);
    Req->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *Bearer));
    Req->OnProcessRequestComplete().BindLambda([OnDone, bRestRows](FHttpRequestPtr, FHttpResponsePtr Res, bool bOk)
    {
        FVitruvianAvatar Avatar;
        if (!bOk || !Res.IsValid() || Res->GetResponseCode() != 200)
        {
            OnDone.ExecuteIfBound(false, Avatar, FString::Printf(TEXT("HTTP %d"), Res.IsValid() ? Res->GetResponseCode() : 0));
            return;
        }
        FString Body = Res->GetContentAsString();
        if (bRestRows)
        {
            // PostgREST returns [{ "package": { ... } }]
            TArray<TSharedPtr<FJsonValue>> Rows;
            const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(Body);
            if (!FJsonSerializer::Deserialize(R, Rows) || Rows.Num() == 0)
            {
                OnDone.ExecuteIfBound(false, Avatar, TEXT("No avatar saved for this account"));
                return;
            }
            const TSharedPtr<FJsonObject>* Pkg = nullptr;
            if (!Rows[0]->AsObject()->TryGetObjectField(TEXT("package"), Pkg))
            {
                OnDone.ExecuteIfBound(false, Avatar, TEXT("Malformed row"));
                return;
            }
            Body.Empty();
            const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Body);
            FJsonSerializer::Serialize((*Pkg).ToSharedRef(), W);
        }
        FString Err;
        const bool bParsed = UVitruvianPortLibrary::ParseAvatarPackage(Body, Avatar, Err);
        OnDone.ExecuteIfBound(bParsed, Avatar, Err);
    });
    Req->ProcessRequest();
}

void UVitruvianPortLibrary::FetchAvatarByCode(const FString& SupabaseUrl, const FString& AnonKey, const FString& Code, FOnVitruvianAvatar OnDone)
{
    SendGet(SupabaseUrl / TEXT("functions/v1/vitruvian-port/packages") / Code.ToUpper(), AnonKey, AnonKey, false, OnDone);
}

void UVitruvianPortLibrary::FetchMyLatestAvatar(const FString& SupabaseUrl, const FString& AnonKey, const FString& UserAccessToken, FOnVitruvianAvatar OnDone)
{
    SendGet(SupabaseUrl / TEXT("rest/v1/vitruvian_latest_avatar?select=package&limit=1"), AnonKey, UserAccessToken, true, OnDone);
}

TMap<FName, float> UVitruvianPortLibrary::ComputeBoneScales(const FVitruvianAvatar& Avatar, const TMap<FName, float>& ReferenceLengthsCm, float MinScale, float MaxScale)
{
    TMap<FName, float> Out;
    for (const FVitruvianSkeletonSegment& S : Avatar.Skeleton)
    {
        const float* Ref = ReferenceLengthsCm.Find(S.FromBone);
        if (!Ref || *Ref <= KINDA_SMALL_NUMBER || S.LengthCm <= 0.f) continue;
        Out.Add(S.FromBone, FMath::Clamp(S.LengthCm / *Ref, MinScale, MaxScale));
    }
    return Out;
}
