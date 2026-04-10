namespace Rass.Api.Domain.Entities;

/// <summary>
/// Rwanda administrative hierarchy: Province -> District -> Sector -> Cell.
/// Used for dropdowns, validation, and geographic filtering across the platform.
/// </summary>
public static class RwandaAdminData
{
    private static readonly Dictionary<string, string> ProvinceAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Kigali"] = "Kigali City",
        ["Kigali City"] = "Kigali City",
        ["Northern"] = "Northern",
        ["Southern"] = "Southern",
        ["Eastern"] = "Eastern",
        ["Western"] = "Western",
    };

    public static readonly Dictionary<string, Dictionary<string, string[]>> Hierarchy = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Kigali City"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Gasabo"] = new[] { "Bumbogo", "Gatsata", "Gikomero", "Gisozi", "Jabana", "Jali", "Kacyiru", "Kimihurura", "Kimironko", "Kinyinya", "Ndera", "Nduba", "Remera", "Rusororo", "Rutunga" },
            ["Kicukiro"] = new[] { "Gahanga", "Gatenga", "Gikondo", "Kagarama", "Kanombe", "Kicukiro", "Kigarama", "Masaka", "Niboye", "Nyarugunga" },
            ["Nyarugenge"] = new[] { "Gitega", "Kanyinya", "Kigali", "Kimisagara", "Mageragere", "Muhima", "Nyakabanda", "Nyamirambo", "Nyarugenge", "Rwezamenyo" },
        },
        ["Northern"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Burera"] = new[] { "Bungwe", "Butaro", "Cyanika", "Cyeru", "Gahunga", "Gatebe", "Gitovu", "Kagogo", "Kinoni", "Kinyababa", "Kivuye", "Nemba", "Rugarama", "Rugengabari", "Ruhunde", "Rusarabuye", "Rwerere" },
            ["Gakenke"] = new[] { "Busengo", "Coko", "Cyabingo", "Gakenke", "Gashenyi", "Janja", "Kamubuga", "Karambo", "Kivuruga", "Mataba", "Minazi", "Muhondo", "Muyongwe", "Muzo", "Nemba", "Ruli", "Rusasa", "Rushashi" },
            ["Gicumbi"] = new[] { "Bukure", "Bwisige", "Byumba", "Cyumba", "Giti", "Kaniga", "Manyagiro", "Miyove", "Muko", "Mutete", "Nyamiyaga", "Nyankenke", "Rubaya", "Rukomo", "Rushaki", "Rutare", "Ruvune", "Rwamiko", "Shangasha" },
            ["Musanze"] = new[] { "Busogo", "Cyuve", "Gacaca", "Gashaki", "Gataraga", "Kimonyi", "Kinigi", "Muhoza", "Muko", "Musanze", "Nkotsi", "Nyange", "Remera", "Rwaza", "Shingiro" },
            ["Rulindo"] = new[] { "Base", "Burega", "Bushoki", "Buyoga", "Cyinzuzi", "Cyungo", "Kinihira", "Kisaro", "Masoro", "Mbogo", "Murambi", "Ngoma", "Ntarabana", "Rukozo", "Rusiga", "Shyorongi", "Tumba" },
        },
        ["Southern"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Gisagara"] = new[] { "Gikonko", "Gishubi", "Kansi", "Kibilizi", "Kigembe", "Mamba", "Muganza", "Mugombwa", "Mukindo", "Musha", "Ndora", "Nyanza", "Save" },
            ["Huye"] = new[] { "Gishamvu", "Huye", "Karama", "Kigoma", "Kinazi", "Maraba", "Mbazi", "Mukura", "Ngoma", "Ruhashya", "Rusatira", "Rwaniro", "Simbi", "Tumba" },
            ["Kamonyi"] = new[] { "Gacurabwenge", "Karama", "Kayenzi", "Kayumbu", "Mugina", "Musambira", "Ngamba", "Nyamiyaga", "Nyarubaka", "Rugarika", "Rukoma", "Runda" },
            ["Muhanga"] = new[] { "Cyeza", "Kabacuzi", "Kibangu", "Kiyumba", "Muhanga", "Mushishiro", "Nyabinoni", "Nyamabuye", "Nyarusange", "Rongi", "Rugendabari", "Shyogwe" },
            ["Nyamagabe"] = new[] { "Buruhukiro", "Cyanika", "Gatare", "Kaduha", "Kamegeri", "Kibirizi", "Kibumbwe", "Kitabi", "Mbazi", "Mugano", "Musange", "Musebeya", "Mushubi", "Nkomane", "Tare", "Uwinkingi" },
            ["Nyanza"] = new[] { "Busasamana", "Busoro", "Cyabakamyi", "Kibilizi", "Kigoma", "Mukingo", "Muyira", "Ntyazo", "Nyagisozi", "Rwabicuma" },
            ["Nyaruguru"] = new[] { "Busanze", "Cyahinda", "Kibeho", "Kivu", "Mata", "Muganza", "Munini", "Ngera", "Ngoma", "Nyabimata", "Nyagisozi", "Ruheru", "Ruramba", "Rusenge" },
            ["Ruhango"] = new[] { "Bweramana", "Byimana", "Kabagari", "Kinazi", "Kinihira", "Mbuye", "Mwendo", "Ntongwe", "Ruhango" },
        },
        ["Eastern"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Bugesera"] = new[] { "Gashora", "Juru", "Kamabuye", "Mareba", "Mayange", "Musenyi", "Mwogo", "Ngeruka", "Ntarama", "Nyamata", "Nyarugenge", "Rilima", "Ruhuha", "Rweru", "Shyara" },
            ["Gatsibo"] = new[] { "Gasange", "Gatsibo", "Gitoki", "Kabarore", "Kageyo", "Kiramuruzi", "Kiziguro", "Muhura", "Murambi", "Ngarama", "Nyagihanga", "Remera", "Rugarama", "Rwimbogo" },
            ["Kayonza"] = new[] { "Gahini", "Kabare", "Kabarondo", "Mukarange", "Murama", "Murundi", "Mwiri", "Ndego", "Nyamirama", "Rwinkwavu" },
            ["Kirehe"] = new[] { "Gahara", "Gatore", "Kigarama", "Kigina", "Kirehe", "Mahama", "Mpanga", "Musaza", "Mushikiri", "Nasho", "Nyamugari", "Nyarubuye" },
            ["Ngoma"] = new[] { "Gashanda", "Jarama", "Karembo", "Kazo", "Kibungo", "Mugesera", "Murama", "Mutenderi", "Remera", "Rukira", "Rukumberi", "Rurenge", "Sake" },
            ["Nyagatare"] = new[] { "Gatunda", "Karama", "Karangazi", "Katabagemu", "Kiyombe", "Matimba", "Mimuri", "Mukama", "Musheli", "Nyagatare", "Rukomo", "Rwempasha", "Rwimiyaga", "Tabagwe" },
            ["Rwamagana"] = new[] { "Fumbwe", "Gahengeri", "Gishari", "Karenge", "Kigabiro", "Muhazi", "Munyaga", "Munyiginya", "Musha", "Muyumbu", "Nzige", "Rubona" },
        },
        ["Western"] = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Karongi"] = new[] { "Bwishyura", "Gishyita", "Gitesi", "Mubuga", "Murambi", "Murundi", "Mutuntu", "Rubengera", "Rugabano", "Ruganda", "Rwankuba", "Twumba" },
            ["Ngororero"] = new[] { "Bwira", "Gatumba", "Hindiro", "Kageyo", "Kavumu", "Matyazo", "Muhanda", "Muhororo", "Ndaro", "Ngororero", "Nyange", "Sovu" },
            ["Nyabihu"] = new[] { "Bigogwe", "Jenda", "Jomba", "Kabatwa", "Karago", "Kintobo", "Mukamira", "Muringa", "Rambura", "Rugera", "Rurembo", "Shyira" },
            ["Nyamasheke"] = new[] { "Bushekeri", "Bushenge", "Cyato", "Gihombo", "Kagano", "Kanjongo", "Karambi", "Karengera", "Kirimbi", "Macuba", "Mahembe", "Nyabitekeri", "Rangiro", "Ruharambuga", "Shangi" },
            ["Rubavu"] = new[] { "Bugeshi", "Busasamana", "Cyanzarwe", "Gisenyi", "Kanama", "Kanzenze", "Mudende", "Nyakiriba", "Nyamyumba", "Nyundo", "Rubavu", "Rugerero" },
            ["Rusizi"] = new[] { "Bugarama", "Butare", "Bweyeye", "Gashonga", "Giheke", "Gihundwe", "Gikundamvura", "Kamembe", "Muganza", "Mururu", "Nkanka", "Nkungu", "Nyakabuye", "Nyakarenzo", "Nzahaha" },
            ["Rutsiro"] = new[] { "Boneza", "Gihango", "Kigeyo", "Kivumu", "Manihira", "Mukura", "Murunda", "Musasa", "Mushonyi", "Mushubati", "Nyabirasi", "Ruhango", "Rusebeya" },
        },
    };

    public static string[] GetProvinces() => Hierarchy.Keys.OrderBy(p => p).ToArray();

    public static string[] GetDistricts(string province)
    {
        var normalizedProvince = NormalizeProvince(province);
        return normalizedProvince != null && Hierarchy.TryGetValue(normalizedProvince, out var districts)
            ? districts.Keys.OrderBy(d => d).ToArray()
            : Array.Empty<string>();
    }

    public static string[] GetAllDistricts()
    {
        return Hierarchy.Values.SelectMany(p => p.Keys).OrderBy(d => d).ToArray();
    }

    public static string[] GetSectors(string district)
    {
        var normalizedDistrict = FindDistrict(district);
        if (normalizedDistrict == null)
            return Array.Empty<string>();

        foreach (var province in Hierarchy.Values)
        {
            if (province.TryGetValue(normalizedDistrict, out var sectors))
                return sectors.OrderBy(s => s).ToArray();
        }

        return Array.Empty<string>();
    }

    public static string[] GetAllSectors()
    {
        return Hierarchy.Values.SelectMany(d => d.Values).SelectMany(s => s).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s).ToArray();
    }

    public static string? GetProvinceForDistrict(string district)
    {
        var normalizedDistrict = FindDistrict(district);
        if (normalizedDistrict == null)
            return null;

        foreach (var (province, districts) in Hierarchy)
        {
            if (districts.ContainsKey(normalizedDistrict))
                return province;
        }

        return null;
    }

    public static string? NormalizeProvince(string? province)
    {
        if (string.IsNullOrWhiteSpace(province))
            return null;

        var trimmed = province.Trim();
        if (ProvinceAliases.TryGetValue(trimmed, out var alias))
            return alias;

        return Hierarchy.Keys.FirstOrDefault(key => key.Equals(trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public static string? FindDistrict(string? district)
    {
        if (string.IsNullOrWhiteSpace(district))
            return null;

        var trimmed = district.Trim();
        foreach (var districts in Hierarchy.Values)
        {
            var match = districts.Keys.FirstOrDefault(value => value.Equals(trimmed, StringComparison.OrdinalIgnoreCase));
            if (match != null)
                return match;
        }

        return null;
    }

    public static string? FindSector(string? district, string? sector)
    {
        if (string.IsNullOrWhiteSpace(district) || string.IsNullOrWhiteSpace(sector))
            return null;

        var normalizedDistrict = FindDistrict(district);
        if (normalizedDistrict == null)
            return null;

        var sectors = GetSectors(normalizedDistrict);
        return sectors.FirstOrDefault(value => value.Equals(sector.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static bool IsValidHierarchy(string? province, string? district, string? sector)
    {
        var normalizedProvince = NormalizeProvince(province) ?? GetProvinceForDistrict(district ?? string.Empty);
        var normalizedDistrict = FindDistrict(district);
        var normalizedSector = FindSector(district, sector);

        if (normalizedProvince == null || normalizedDistrict == null || normalizedSector == null)
            return false;

        return Hierarchy.TryGetValue(normalizedProvince, out var districts)
               && districts.TryGetValue(normalizedDistrict, out var sectors)
               && sectors.Contains(normalizedSector, StringComparer.OrdinalIgnoreCase);
    }

    public static (string Province, string District, string Sector)? NormalizeHierarchy(string? province, string? district, string? sector)
    {
        if (!IsValidHierarchy(province, district, sector))
            return null;

        var normalizedDistrict = FindDistrict(district)!;
        var normalizedProvince = NormalizeProvince(province) ?? GetProvinceForDistrict(normalizedDistrict)!;
        var normalizedSector = FindSector(normalizedDistrict, sector)!;
        return (normalizedProvince, normalizedDistrict, normalizedSector);
    }
}
