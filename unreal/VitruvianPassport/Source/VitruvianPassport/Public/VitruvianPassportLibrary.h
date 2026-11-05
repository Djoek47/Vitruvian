#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "VitruvianPassportTypes.h"
#include "VitruvianPassportLibrary.generated.h"

UCLASS()
class VITRUVIANPASSPORT_API UVitruvianPassportLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    /** Load a `*-unreal.json` export. Returns false with a reason on failure. */
    UFUNCTION(BlueprintCallable, Category = "Faberland|Vitruvian")
    static bool LoadVitruvianPassport(const FString& FilePath, FVitruvianPassport& OutPassport, FString& OutError);

    /** Parse from a JSON string (e.g. received from the Vitruvian web extension). */
    UFUNCTION(BlueprintCallable, Category = "Faberland|Vitruvian")
    static bool ParseVitruvianPassport(const FString& Json, FVitruvianPassport& OutPassport, FString& OutError);

    /** Look up a measurement by id (e.g. "chest_circumference"). */
    UFUNCTION(BlueprintPure, Category = "Faberland|Vitruvian")
    static bool GetMeasurementCm(const FVitruvianPassport& Passport, const FString& Id, float& ValueCm, float& UncertaintyCm, FString& Method);

    /** Landmark location in the subject's floor frame (cm, X fwd / Y right / Z up). */
    UFUNCTION(BlueprintPure, Category = "Faberland|Vitruvian")
    static bool GetLandmarkLocation(const FVitruvianPassport& Passport, const FString& Id, FVector& Location);
};
