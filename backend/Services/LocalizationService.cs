namespace Rass.Api.Services;

public record LocalizedMessage(string Code, string Message);

public interface ILocalizationService
{
    LocalizedMessage Message(string code, string lang);
    string GetLanguage(HttpRequest request);
}

public class LocalizationService : ILocalizationService
{
    private static readonly Dictionary<string, (string En, string Kin)> Messages = new()
    {
        ["auth.invalid_credentials"] = ("Invalid credentials.", "Amakuru atari yo."),
        ["auth.farmer_phone_only"] = ("Phone login is only available for Farmer accounts.", "Kwinjira kuri telefoni bigenewe abahinzi gusa."),
        ["auth.farmer_not_found_phone"] = ("No farmer account found with this phone number.", "Nta konti y'umuhinzi ibonetse kuri iyi telefoni."),
        ["auth.account_not_activated"] = ("Account not activated. Please set your password first.", "Konti ntirashyirwaho. Banza ushyireho ijambo ry'ibanga."),
        ["auth.account_inactive"] = ("User account is inactive.", "Konti y'ukoresha yahagaritswe."),
        ["auth.otp_sent_if_exists"] = ("If an account exists, an OTP has been sent.", "Niba konti ibaho, OTP yoherejwe."),
        ["auth.otp_invalid_or_expired"] = ("Invalid OTP or expired.", "OTP si yo cyangwa yararangiye."),
        ["auth.otp_not_requested"] = ("No OTP requested. Please request a new one.", "Nta OTP yasabwe. Saba indi."),
        ["auth.otp_expired"] = ("OTP has expired. Please request a new one.", "OTP yararangiye. Saba indi."),
        ["auth.otp_invalid"] = ("Invalid OTP.", "OTP si yo."),
        ["auth.otp_verified"] = ("OTP verified successfully.", "OTP yemejwe neza."),
        ["auth.passwords_mismatch"] = ("Passwords do not match.", "Amagambo y'ibanga ntabwo ahura."),
        ["auth.reset_invalid_request"] = ("Invalid request.", "Gusaba ntibyemewe."),
        ["auth.reset_no_otp"] = ("No OTP requested.", "Nta OTP yasabwe."),
        ["auth.reset_success"] = ("Password reset successfully! You can now log in.", "Ijambo ry'ibanga rihinduwe neza! Ushobora kwinjira."),
        ["auth.activation_password_mismatch"] = ("Passwords do not match.", "Amagambo y'ibanga ntabwo ahura."),
        ["auth.activation_user_not_found"] = ("User not found.", "Ukoresha ntabonetse."),
        ["auth.activation_only_farmer"] = ("Only Farmer accounts can be activated through this flow.", "Iyi nzira igenewe konti z'abahinzi gusa."),
        ["auth.activation_already_done"] = ("Account already activated. Please login normally.", "Konti yamaze kwemezwa. Injira uko bisanzwe."),
        ["auth.activation_success"] = ("Account activated successfully! You can now log in.", "Konti yemejwe neza! Ushobora kwinjira.")
    };

    public LocalizedMessage Message(string code, string lang)
    {
        if (!Messages.TryGetValue(code, out var msg))
        {
            return new LocalizedMessage(code, code);
        }

        var normalized = lang.ToLowerInvariant();
        var text = normalized.StartsWith("kin") ? msg.Kin : msg.En;
        return new LocalizedMessage(code, text);
    }

    public string GetLanguage(HttpRequest request)
    {
        var header = request.Headers["X-Lang"].ToString();
        if (!string.IsNullOrWhiteSpace(header))
        {
            return header;
        }

        var acceptLang = request.Headers["Accept-Language"].ToString();
        if (!string.IsNullOrWhiteSpace(acceptLang))
        {
            return acceptLang.Split(',')[0];
        }

        return "en";
    }
}
