using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lionfish.App.Models;
using Lionfish.Core.Actions;
using Lionfish.Core.Interception;
using Lionfish.Core.Macros;
using Macro = Lionfish.App.Models.Macro;
using MacroStep = Lionfish.App.Models.MacroStep;

namespace Lionfish.App.ViewModels;

public partial class MacroEditorViewModel : ObservableObject
{
    private readonly string _macrosFile;
    private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true, PropertyNameCaseInsensitive = true };
    private readonly MacroPlayer _player = new();
    private DateTime _lastRecordTime;
    private CancellationTokenSource? _playCts;

    [ObservableProperty] private ObservableCollection<Macro> _macros = new();
    [ObservableProperty] private Macro? _selectedMacro;
    [ObservableProperty] private ObservableCollection<MacroStep> _steps = new();
    [ObservableProperty] private bool _isRecording;
    [ObservableProperty] private bool _isPlaying;

    public MacroEditorViewModel()
    {
        string configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Lionfish");
        Directory.CreateDirectory(configDir);
        _macrosFile = Path.Combine(configDir, "macros.json");

        LoadMacros();
    }

    private void LoadMacros()
    {
        Macros.Clear();
        if (File.Exists(_macrosFile))
        {
            try
            {
                var json = File.ReadAllText(_macrosFile);
                var coreMacros = JsonSerializer.Deserialize<List<Lionfish.Core.Macros.Macro>>(json, _jsonOptions);
                if (coreMacros != null && coreMacros.Count > 0)
                {
                    foreach (var cm in coreMacros)
                    {
                        Macros.Add(Macro.FromCoreMacro(cm));
                    }
                }
            }
            catch { }
        }

        if (Macros.Count == 0)
        {
            SeedDefaultMacros();
        }

        SelectedMacro = Macros.FirstOrDefault();
    }

    private void SeedDefaultMacros()
    {
        var m1 = new Macro { Name = "Spam Jump", StepCount = 3 };
        m1.Steps.Add(new MacroStep { StepType = "KeyDown", Key = "Space", TypeIcon = "⬇", Description = "Key Down: Space", Delay = 0 });
        m1.Steps.Add(new MacroStep { StepType = "Delay", TypeIcon = "⏱", Description = "Delay 50ms", Delay = 50 });
        m1.Steps.Add(new MacroStep { StepType = "KeyUp", Key = "Space", TypeIcon = "⬆", Description = "Key Up: Space", Delay = 50 });
        Macros.Add(m1);

        var m2 = new Macro { Name = "Enter Chat & Greet", StepCount = 3 };
        m2.Steps.Add(new MacroStep { StepType = "KeyPress", Key = "Return", TypeIcon = "⚡", Description = "Key Press: Enter", Delay = 0 });
        m2.Steps.Add(new MacroStep { StepType = "TextType", Text = "Good game, well played!", TypeIcon = "🔤", Description = "Type: Good game, well played!", Delay = 100 });
        m2.Steps.Add(new MacroStep { StepType = "KeyPress", Key = "Return", TypeIcon = "⚡", Description = "Key Press: Enter", Delay = 50 });
        Macros.Add(m2);

        SaveMacros();
    }

    public void SaveMacros()
    {
        try
        {
            var coreList = Macros.Select(m => m.ToCoreMacro()).ToList();
            var json = JsonSerializer.Serialize(coreList, _jsonOptions);
            File.WriteAllText(_macrosFile, json);
        }
        catch { }
    }

    partial void OnSelectedMacroChanged(Macro? value)
    {
        Steps.Clear();
        if (value != null)
        {
            foreach (var s in value.Steps)
            {
                Steps.Add(s);
            }
        }
    }

    public void OnKeyIntercepted(Lionfish.Core.Interception.DeviceInfo device, Lionfish.Core.Interception.InterceptedKeyEventArgs e)
    {
        if (!IsRecording || SelectedMacro == null) return;

        System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
        {
            var now = DateTime.Now;
            int delay = (int)(now - _lastRecordTime).TotalMilliseconds;
            if (delay > 5000) delay = 50; // Cap long pauses
            _lastRecordTime = now;

            var step = new MacroStep
            {
                StepType = e.IsKeyDown ? "KeyDown" : "KeyUp",
                Key = e.KeyName,
                Delay = delay,
                TypeIcon = e.IsKeyDown ? "⬇" : "⬆",
                Description = $"{(e.IsKeyDown ? "Key Down" : "Key Up")}: {e.KeyName}"
            };

            Steps.Add(step);
            SelectedMacro.Steps.Add(step);
            SelectedMacro.StepCount = Steps.Count;
        });
    }

    [RelayCommand]
    private void NewMacro()
    {
        var m = new Macro { Name = $"Macro {Macros.Count + 1}", StepCount = 0 };
        Macros.Add(m);
        SelectedMacro = m;
        Steps.Clear();
        SaveMacros();
    }

    [RelayCommand]
    private void DeleteMacro(Macro? m)
    {
        if (m == null) return;
        Macros.Remove(m);
        SelectedMacro = Macros.FirstOrDefault();
        SaveMacros();
    }

    [RelayCommand]
    private void AddStep(string type)
    {
        if (SelectedMacro == null) return;

        var step = new MacroStep
        {
            StepType = type,
            Delay = type == "Delay" ? 100 : 0,
            TypeIcon = type switch
            {
                "KeyDown" => "⬇",
                "KeyUp" => "⬆",
                "TextType" => "🔤",
                "Delay" => "⏱",
                _ => "⚡"
            },
            Description = type switch
            {
                "Delay" => "Delay 100ms",
                "TextType" => "Type: Hello",
                _ => $"{type}: Space"
            },
            Key = "Space",
            Text = type == "TextType" ? "Hello" : ""
        };

        Steps.Add(step);
        SelectedMacro.Steps.Add(step);
        SelectedMacro.StepCount = Steps.Count;
        SaveMacros();
    }

    [RelayCommand]
    private void RemoveStep(MacroStep? step)
    {
        if (step == null || SelectedMacro == null) return;
        Steps.Remove(step);
        SelectedMacro.Steps.Remove(step);
        SelectedMacro.StepCount = Steps.Count;
        SaveMacros();
    }

    [RelayCommand]
    private void MoveStepUp(MacroStep? step)
    {
        if (step == null || SelectedMacro == null) return;
        int index = Steps.IndexOf(step);
        if (index > 0)
        {
            Steps.Move(index, index - 1);
            SelectedMacro.Steps.Move(index, index - 1);
            SaveMacros();
        }
    }

    [RelayCommand]
    private void MoveStepDown(MacroStep? step)
    {
        if (step == null || SelectedMacro == null) return;
        int index = Steps.IndexOf(step);
        if (index >= 0 && index < Steps.Count - 1)
        {
            Steps.Move(index, index + 1);
            SelectedMacro.Steps.Move(index, index + 1);
            SaveMacros();
        }
    }

    [RelayCommand]
    private void StartRecording()
    {
        if (SelectedMacro == null) return;
        IsRecording = true;
        _lastRecordTime = DateTime.Now;
    }

    [RelayCommand]
    private void StopRecording()
    {
        IsRecording = false;
        SaveMacros();
    }

    [RelayCommand]
    private async Task PlayAsync()
    {
        if (SelectedMacro == null || IsPlaying) return;

        IsPlaying = true;
        _playCts = new CancellationTokenSource();

        try
        {
            var coreMacro = SelectedMacro.ToCoreMacro();
            await _player.PlayAsync(coreMacro, _playCts.Token);
        }
        catch (OperationCanceledException) { }
        finally
        {
            IsPlaying = false;
        }
    }

    [RelayCommand]
    private void Stop()
    {
        _playCts?.Cancel();
        _player.Stop();
        IsPlaying = false;
        IsRecording = false;
    }
}
