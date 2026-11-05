using UnrealBuildTool;

public class VitruvianPassport : ModuleRules
{
    public VitruvianPassport(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "Json", "JsonUtilities", "HTTP" });
    }
}
