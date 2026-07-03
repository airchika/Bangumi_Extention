$url = 'https://bgm.tv/user/shironegi?ying-shi=1'
Start-Process -FilePath "microsoft-edge:$url"

Start-Sleep -Milliseconds 500
$edge = Get-Process -Name msedge -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1

if ($edge) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class EdgeWindow {
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool FlashWindow(IntPtr hWnd, bool invert);
}
'@

    # SW_MAXIMIZE = 3：打开测试页后最大化 Edge 窗口
    [EdgeWindow]::ShowWindowAsync($edge.MainWindowHandle, 3) | Out-Null
    $focused = [EdgeWindow]::SetForegroundWindow($edge.MainWindowHandle)
    if (-not $focused) {
        $shell = New-Object -ComObject WScript.Shell
        $focused = $shell.AppActivate($edge.Id)
    }
    if (-not $focused) {
        [EdgeWindow]::FlashWindow($edge.MainWindowHandle, $true) | Out-Null
    }
}
