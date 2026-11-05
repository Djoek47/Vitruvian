// Faberland Port for Unreal: load an avatar package (faberland.avatar-package@1) sent from the
// Vitruvian headset app via Supabase, and turn it into MetaHuman-ready data.
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "VitruvianPassportTypes.h"
#include "VitruvianPortLibrary.generated.h"

USTRUCT(BlueprintType)
struct FVitruvianSkeletonSegment
{
    GENERATED_BODY()
    /** UE5 / MetaHuman bone where the segment starts (e.g. upperarm_r). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FName FromBone;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FName ToBone;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float LengthCm = 0.f;
};

USTRUCT(BlueprintType)
struct FVitruvianAvatar
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString ProfileId;
    /** SHA-256 integrity digest of the package (store it on the avatar for traceability). */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Digest;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") bool bSimulated = false;
    /** Measurements, landmarks (cm, X fwd / Y right / Z up), subject, composition, skin. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FVitruvianPassport Passport;
    /** Suggested MetaHuman base body, legacy naming {m|f}_{srt|med|tal}_{unw|nrw|ovw}; empty when unknown. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString BaseBodyPreset;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") TArray<FVitruvianSkeletonSegment> Skeleton;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") bool bHasSkin = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FLinearColor SkinLinear = FLinearColor::Black;
};

DECLARE_DYNAMIC_DELEGATE_ThreeParams(FOnVitruvianAvatar, bool, bSuccess, const FVitruvianAvatar&, Avatar, const FString&, Error);

UCLASS()
class VITRUVIANPASSPORT_API UVitruvianPortLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    /** Parse a faberland.avatar-package@1 JSON string (file, postMessage or HTTP body). */
    UFUNCTION(BlueprintCallable, Category = "Faberland|Vitruvian Port")
    static bool ParseAvatarPackage(const FString& Json, FVitruvianAvatar& OutAvatar, FString& OutError);

    /** Load by claim code from the `vitruvian-port` Supabase Edge Function. SupabaseUrl = https://<ref>.supabase.co */
    UFUNCTION(BlueprintCallable, Category = "Faberland|Vitruvian Port")
    static void FetchAvatarByCode(const FString& SupabaseUrl, const FString& AnonKey, const FString& Code, FOnVitruvianAvatar OnDone);

    /** Load the signed-in user's latest avatar (Supabase REST + RLS). UserAccessToken = Supabase Auth JWT. */
    UFUNCTION(BlueprintCallable, Category = "Faberland|Vitruvian Port")
    static void FetchMyLatestAvatar(const FString& SupabaseUrl, const FString& AnonKey, const FString& UserAccessToken, FOnVitruvianAvatar OnDone);

    /**
     * Per-bone scale factors = measured segment length ÷ the base body's reference length.
     * Apply with Transform (Modify) Bone in the MetaHuman body AnimBP (scale along the bone axis),
     * or UPoseableMeshComponent::SetBoneScaleByName. ReferenceLengthsCm: measure once on the base body.
     */
    UFUNCTION(BlueprintPure, Category = "Faberland|Vitruvian Port")
    static TMap<FName, float> ComputeBoneScales(const FVitruvianAvatar& Avatar, const TMap<FName, float>& ReferenceLengthsCm, float MinScale = 0.8f, float MaxScale = 1.25f);
};
