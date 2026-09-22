using System;
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace Lionfish.App.Converters;

public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        bool boolValue = value is bool b && b;
        if (parameter?.ToString() == "Invert")
        {
            boolValue = !boolValue;
        }

        return boolValue ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is Visibility visibility)
        {
            bool result = visibility == Visibility.Visible;
            if (parameter?.ToString() == "Invert")
            {
                result = !result;
            }
            return result;
        }
        return false;
    }
}
