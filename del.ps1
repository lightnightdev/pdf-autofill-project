$ftp = "ftp://ftp.lightnightdev.com/autofill/"
$user = "lightnig"
$pass = "ElioraAppa2024!"

$req = [System.Net.FtpWebRequest]::Create($ftp)
$req.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
$req.Credentials = New-Object System.Net.NetworkCredential($user,$pass)
$response = $req.GetResponse()
$reader = New-Object IO.StreamReader($response.GetResponseStream())
$files = $reader.ReadToEnd().Split("`n")

foreach ($file in $files) {
    $file = $file.Trim()
    if ($file -ne "") {
        $del = [System.Net.FtpWebRequest]::Create($ftp + $file)
        $del.Credentials = New-Object System.Net.NetworkCredential($user,$pass)
        $del.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
        try { $del.GetResponse() | Out-Null } catch {}
    }
}
