param(
  [string]$WorkbookPath = 'C:\Users\Antz Work\Desktop\Courses File\MANCILLA.xls',
  [string]$SheetName,
  [string]$SectionId,
  [string]$SupabaseUrl = $env:VITE_SUPABASE_URL,
  [string]$SupabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not $SheetName) {
  throw "Pass -SheetName. This workbook contains multiple class sheets."
}
if (-not $SectionId) {
  throw "Pass -SectionId for the Supabase section that will receive these enrollments."
}
if (-not $SupabaseUrl -or -not $SupabaseKey) {
  throw "Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the importer."
}
if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

$headers = @{
  apikey = $SupabaseKey
  Authorization = "Bearer $SupabaseKey"
  'Content-Type' = 'application/json'
  Prefer = 'return=representation'
}

function Invoke-Supabase {
  param(
    [string]$Path,
    [string]$Method = 'GET',
    [object]$Body
  )

  $params = @{
    Uri = "$SupabaseUrl/rest/v1/$Path"
    Method = $Method
    Headers = $headers
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  Invoke-RestMethod @params
}

function Escape-FilterValue([string]$Value) {
  [uri]::EscapeDataString($Value)
}

$excel = $null
$workbook = $null
$sheet = $null
$imported = 0
$skipped = 0

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)
  $sheet = $workbook.Worksheets.Item($SheetName)
  $used = $sheet.UsedRange

  if ($used.Rows.Count -lt 12) {
    throw "Sheet '$SheetName' does not contain the expected row-12 header."
  }

  Write-Output "Importing sheet: $SheetName"
  Write-Output "Target section: $SectionId"

  for ($row = 13; $row -le $used.Rows.Count; $row++) {
    $ctrlNo = $sheet.Cells.Item($row, 1).Text.Trim()
    $studentNo = $sheet.Cells.Item($row, 2).Text.Trim()
    $fullName = $sheet.Cells.Item($row, 3).Text.Trim()
    $genderText = $sheet.Cells.Item($row, 4).Text.Trim()
    $course = $sheet.Cells.Item($row, 5).Text.Trim()
    $yearLevel = $sheet.Cells.Item($row, 6).Text.Trim()
    $contactNo = $sheet.Cells.Item($row, 7).Text.Trim()
    $email = $sheet.Cells.Item($row, 8).Text.Trim()

    if (-not $studentNo -or -not $fullName) {
      $skipped++
      continue
    }

    $gender = if ($genderText -match '^female$') { 'F' } elseif ($genderText -match '^male$') { 'M' } else { $null }
    $studentPayload = @{
      student_no = $studentNo
      full_name = $fullName
      gender = $gender
    }

    if ($DryRun) {
      Write-Output ("DRY-RUN|CTRL {0}|{1}|{2}|{3}|{4}|{5}" -f $ctrlNo, $studentNo, $fullName, $genderText, $course, $yearLevel)
      $imported++
      continue
    }

    $studentFilter = "students?student_no=eq.$(Escape-FilterValue $studentNo)&select=id"
    $existingStudent = @(Invoke-Supabase -Path $studentFilter)

    if ($existingStudent.Count -gt 0) {
      $studentId = $existingStudent[0].id
      Invoke-Supabase -Path "students?id=eq.$studentId" -Method PATCH -Body $studentPayload | Out-Null
    } else {
      $createdStudent = @(Invoke-Supabase -Path 'students' -Method POST -Body $studentPayload)
      $studentId = $createdStudent[0].id
    }

    $enrollmentFilter = "enrollments?section_id=eq.$SectionId&student_id=eq.$studentId&select=id"
    $existingEnrollment = @(Invoke-Supabase -Path $enrollmentFilter)

    if ($existingEnrollment.Count -eq 0) {
      Invoke-Supabase -Path 'enrollments' -Method POST -Body @{
        section_id = $SectionId
        student_id = $studentId
        ctrl_no = [int]$ctrlNo
        status = 'active'
      } | Out-Null
    }

    $imported++
    Write-Output ("IMPORTED|{0}|{1}" -f $studentNo, $fullName)
  }
} finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
}

Write-Output ("Complete. Imported: {0}; skipped: {1}" -f $imported, $skipped)


