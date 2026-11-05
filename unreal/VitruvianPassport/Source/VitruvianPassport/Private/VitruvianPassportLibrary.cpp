#include "VitruvianPassportLibrary.h"
#include "JsonObjectConverter.h"
#include "Misc/FileHelper.h"

bool UVitruvianPassportLibrary::ParseVitruvianPassport(const FString& Json, FVitruvianPassport& OutPassport, FString& OutError)
{
    OutPassport = FVitruvianPassport();
    if (!FJsonObjectConverter::JsonObjectStringToUStruct(Json, &OutPassport, 0, 0))
    {
        OutError = TEXT("JSON does not match FVitruvianPassport");
        return false;
    }
    if (!OutPassport.Format.StartsWith(TEXT("ue-passport-")))
    {
        OutError = FString::Printf(TEXT("Unexpected format '%s' (expected ue-passport-1.x)"), *OutPassport.Format);
        return false;
    }
    if (OutPassport.bSimulated)
    {
        OutError = TEXT("Warning: simulated passport (emulator data)");
    }
    return true;
}

bool UVitruvianPassportLibrary::LoadVitruvianPassport(const FString& FilePath, FVitruvianPassport& OutPassport, FString& OutError)
{
    FString Json;
    if (!FFileHelper::LoadFileToString(Json, *FilePath))
    {
        OutError = FString::Printf(TEXT("Cannot read %s"), *FilePath);
        return false;
    }
    return ParseVitruvianPassport(Json, OutPassport, OutError);
}

bool UVitruvianPassportLibrary::GetMeasurementCm(const FVitruvianPassport& Passport, const FString& Id, float& ValueCm, float& UncertaintyCm, FString& Method)
{
    for (const FVitruvianMeasurement& M : Passport.Measurements)
    {
        if (M.Id == Id)
        {
            ValueCm = M.ValueCm;
            UncertaintyCm = M.UncertaintyCm;
            Method = M.Method;
            return true;
        }
    }
    return false;
}

bool UVitruvianPassportLibrary::GetLandmarkLocation(const FVitruvianPassport& Passport, const FString& Id, FVector& Location)
{
    for (const FVitruvianLandmark& L : Passport.Landmarks)
    {
        if (L.Id == Id)
        {
            Location = L.Location;
            return true;
        }
    }
    return false;
}
