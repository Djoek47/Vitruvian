# VitruvianPassport — Unreal Engine plugin

Loads a Vitruvian `*-unreal.json` export (format `ue-passport-1.0`) into Blueprint structs.

> **Status: written against the documented UE APIs (`FJsonObjectConverter`, `FFileHelper`, `UBlueprintFunctionLibrary`), NOT compiled here.** This cloud session has no Unreal Engine. Compile it in your UE 5.x project and report any errors.

## Install
1. Copy this folder to `<YourProject>/Plugins/VitruvianPassport/`.
2. Regenerate project files and build. Enable **Faberland Vitruvian Body Passport** under Edit ▸ Plugins.

## Use
* Blueprint: `Load Vitruvian Passport (FilePath)` returns an `FVitruvianPassport`. Then call `Get Measurement Cm ("chest_circumference")` and `Get Landmark Location ("acromion_l")`.
* DataTable: import `*-unreal-datatable.csv` with row struct **FVitruvianMeasurementRow**.
* Coordinates: cm, **X forward, Y right, Z up**, origin on the floor under the subject. These are Unreal's own conventions, so landmarks drop straight onto a character at the origin.

## MetaHuman
Feed `Measurements` (method + uncertainty included) into your MetaHuman body-fitting step (MetaHuman Creator body measurements in UE 5.6+, or your own morph/bone pipeline). Ignore any value with `Status == "conflicted"`, and down-weight `Method == "estimated"`. `SkinTone.LinearColor` is linear light, ready for a material parameter. Store `ProfileId` + `UpdatedAt` on the MetaHuman asset so every avatar traces back to its passport.
