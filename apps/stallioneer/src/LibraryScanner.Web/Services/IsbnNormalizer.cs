namespace LibraryScanner.Web.Services;

public static class IsbnNormalizer
{
    public static string DigitsOnly(string value)
    {
        return new string(value.Where(char.IsDigit).ToArray());
    }

    public static string? ToIsbn13(string value)
    {
        var digits = DigitsOnly(value);

        return digits.Length switch
        {
            13 when IsValidIsbn13(digits) => digits,
            10 when IsValidIsbn10(value) => ConvertIsbn10ToIsbn13(value),
            _ => null
        };
    }

    public static bool IsValidIsbn13(string value)
    {
        var digits = DigitsOnly(value);

        if (digits.Length != 13)
        {
            return false;
        }

        var sum = 0;
        for (var index = 0; index < 12; index++)
        {
            var digit = digits[index] - '0';
            sum += index % 2 == 0 ? digit : digit * 3;
        }

        var checkDigit = (10 - sum % 10) % 10;
        return checkDigit == digits[12] - '0';
    }

    public static bool IsValidIsbn10(string value)
    {
        var normalized = value.Replace("-", string.Empty).Replace(" ", string.Empty).ToUpperInvariant();
        if (normalized.Length != 10)
        {
            return false;
        }

        var sum = 0;
        for (var index = 0; index < 10; index++)
        {
            var character = normalized[index];
            var digit = character == 'X' && index == 9 ? 10 : character - '0';
            if (digit is < 0 or > 10)
            {
                return false;
            }

            sum += digit * (10 - index);
        }

        return sum % 11 == 0;
    }

    public static string? ConvertIsbn10ToIsbn13(string value)
    {
        if (!IsValidIsbn10(value))
        {
            return null;
        }

        var normalized = value.Replace("-", string.Empty).Replace(" ", string.Empty).ToUpperInvariant();
        var prefix = $"978{normalized[..9]}";
        var sum = 0;
        for (var index = 0; index < 12; index++)
        {
            var digit = prefix[index] - '0';
            sum += index % 2 == 0 ? digit : digit * 3;
        }

        var checkDigit = (10 - sum % 10) % 10;
        return $"{prefix}{checkDigit}";
    }
}
