// Faberland Vitruvian — Body Passport structs for Unreal Engine.
// Field names match the `ue-passport-1.0` JSON exported by the Vitruvian app
// (src/bridge/unreal.ts), so FJsonObjectConverter fills them directly.
// Units: centimetres. Axes: X forward, Y right, Z up; origin = floor under the subject.
#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "VitruvianPassportTypes.generated.h"

USTRUCT(BlueprintType)
struct FVitruvianMeasurement
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Id;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Label;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float ValueCm = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float UncertaintyCm = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float Confidence = 0.f;
    /** direct | derived | estimated | manual */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Method;
    /** validated | unvalidated | conflicted */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Status;
};

USTRUCT(BlueprintType)
struct FVitruvianLandmark
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Id;
    /** cm, X forward, Y right, Z up, origin on the floor under the subject. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FVector Location = FVector::ZeroVector;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") int32 Samples = 1;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float SpreadMm = 0.f;
};

USTRUCT(BlueprintType)
struct FVitruvianSubject
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float WeightKg = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") int32 AgeYears = 0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Sex;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString ShoeSystem;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float ShoeSize = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float FootLengthCm = 0.f;
};

/** ESTIMATES only (BMI, US Navy body fat, lean mass, normalised FFMI). */
USTRUCT(BlueprintType)
struct FVitruvianComposition
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float Bmi = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float BodyFatPct = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float LeanMassKg = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float FfmiNormalized = 0.f;
};

USTRUCT(BlueprintType)
struct FVitruvianSkinTone
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") bool bPresent = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Hex;
    /** Linear-light colour, ready for a material parameter. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FLinearColor LinearColor = FLinearColor::Black;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float ItaDeg = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") int32 Monk = 0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") bool bWhiteBalanced = false;
};

USTRUCT(BlueprintType)
struct FVitruvianPassport
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Format;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString SchemaVersion;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString ProfileId;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString DisplayName;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString UpdatedAt;
    /** true = emulator data. Never fit real garments to it. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") bool bSimulated = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Units;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString CoordinateSystem;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") TArray<FVitruvianMeasurement> Measurements;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") TArray<FVitruvianLandmark> Landmarks;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FVitruvianSubject Subject;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FVitruvianComposition Composition;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FVitruvianSkinTone SkinTone;
};

/** Row struct for the DataTable CSV export (first column = measurement id). */
USTRUCT(BlueprintType)
struct FVitruvianMeasurementRow : public FTableRowBase
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float ValueCm = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float UncertaintyCm = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") float Confidence = 0.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Method;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Vitruvian") FString Status;
};
