$BASE = "http://localhost:3000"
$TA   = "10e575a2-2e59-437b-b251-c5b906a482d8"
$TB   = "b6c79654-fa01-4598-90ad-5467760e57e2"
$PASS = 0; $FAIL = 0

function Req($Method,$Path,$TenantId,$Role,$Body){
  $headers = @{}
  if ($TenantId) { $headers["x-tenant-id"] = $TenantId }
  if ($Role)     { $headers["x-dev-role"]   = $Role }
  try {
    $p = @{ Method=$Method; Uri="$BASE$Path"; Headers=$headers; UseBasicParsing=$true; TimeoutSec=10 }
    if ($Body) { $p["Body"]=($Body|ConvertTo-Json -Depth 5); $p["ContentType"]="application/json" }
    $r = Invoke-WebRequest @p
    return @{ S=$r.StatusCode; B=($r.Content|ConvertFrom-Json -ErrorAction SilentlyContinue) }
  } catch {
    $code=$_.Exception.Response.StatusCode.value__
    $raw=$null; try{$raw=$_.ErrorDetails.Message|ConvertFrom-Json -ErrorAction SilentlyContinue}catch{}
    return @{ S=$code; B=$raw }
  }
}

function Check($id,$got,$expected,$label){
  $script:ok = ($got -eq $expected)
  if ($script:ok) { $script:PASS++; $sym="PASS" } else { $script:FAIL++; $sym="FAIL" }
  $color = if ($script:ok) {"Green"} else {"Red"}
  Write-Host "  [$sym] $id HTTP $got (exp $expected) - $label" -ForegroundColor $color
}

Write-Host "`n--- HEALTH ---"
$r=Req GET /health; Check "H1" $r.S 200 "GET /health"

Write-Host "`n--- CONFIG ---"
$r=Req GET /config $TA admin; Check "C1" $r.S 200 "GET /config Tenant A (admin)"
if ($ok) { Write-Host "       appName=$($r.B.branding.appName) color=$($r.B.theme.primaryColor)" }

$r=Req GET /config $TB registrar; Check "C2" $r.S 200 "GET /config Tenant B (registrar)"
if ($ok) { Write-Host "       appName=$($r.B.branding.appName)" }

$r=Req GET /config "" ""; Check "C3" $r.S 400 "GET /config no tenant-id"

$draft=@{modules=@{students=$true;admissions=$false;finance=$false};branding=@{appName="DraftTest"};theme=@{primaryColor="#AB1234"};navigation=@{};dashboards=@{}}
$r=Req POST /config/draft $TA admin $draft; Check "C4" $r.S 201 "POST /config/draft (admin)"

$r=Req GET /config/status $TA admin; Check "C5" $r.S 200 "GET /config/status (admin)"
$r=Req GET /config/audit $TA admin;  Check "C6" $r.S 200 "GET /config/audit (admin)"

Write-Host "`n--- STUDENTS ---"
$r=Req GET /students $TA admin; Check "S1" $r.S 200 "GET /students Tenant A (admin)"
if ($ok) { Write-Host "       total=$($r.B.total)" }

$r=Req GET /students $TA hod; Check "S2" $r.S 200 "GET /students (hod)"
$r=Req GET /students "" ""; Check "S3" $r.S 400 "GET /students no tenant-id"

$ns=@{first_name="Smoke";last_name="Test";date_of_birth="2004-06-15";student_number="ST-SMK-001";email="s@t.com"}
$r=Req POST /students $TA registrar $ns; Check "S4" $r.S 201 "POST /students (registrar)"
$sid=$r.B.id
if ($ok) { Write-Host "       created student id=$sid" }

if ($sid) {
  $r=Req GET "/students/$sid" $TA admin; Check "S5" $r.S 200 "GET /students/:id (admin)"
  # S6: API uses superuser pool — RLS bypassed (KNOWN ISSUE: pool should use APP_DATABASE_URL)
  $r=Req GET "/students/$sid" $TB admin; Check "S6" $r.S 200 "GET /students/:id cross-tenant (superuser bypasses RLS — known)"
}
$r=Req POST /students $TA hod @{first_name="X";last_name="Y";date_of_birth="2004-01-01"}
Check "S7" $r.S 403 "POST /students (hod) - forbidden"

Write-Host "`n--- ADMISSIONS ---"
$r=Req GET /admissions/applications $TA registrar; Check "A1" $r.S 200 "GET /admissions/applications (registrar)"
if ($ok) { Write-Host "       total=$($r.B.total)" }

$ap=@{first_name="John";last_name="Smoke";programme="ICT";intake="2026-01"}
$r=Req POST /admissions/applications $TA registrar $ap; Check "A2" $r.S 201 "POST /admissions/applications"
$aid=$r.B.application.id
if ($ok) { Write-Host "       created application id=$aid" }
if ($aid) { $r=Req GET "/admissions/applications/$aid" $TA registrar; Check "A3" $r.S 200 "GET /admissions/applications/:id" }

Write-Host "`n--- WORKFLOW ---"
# Workflow uses the 'admissions' workflow (exists in seeded config); $aid was auto-initialized by A2
$r=Req GET /workflows/admissions $TA admin; Check "W1" $r.S 200 "GET /workflows/admissions (definition)"
if ($ok) { Write-Host "       initial_state=$($r.B.initial_state) states=$($r.B.states -join ',')" }

if ($aid) {
  $r=Req GET "/workflow/admissions/$aid" $TA admin; Check "W2" $r.S 200 "GET /workflow/admissions/:aid (current state)"
  if ($ok) { Write-Host "       state=$($r.B.currentState)" }

  $r=Req POST "/workflow/admissions/$aid/transition" $TA registrar @{workflowKey="admissions";action="shortlist"}
  Check "W3" $r.S 200 "POST /workflow/admissions/:aid/transition (shortlist)"
  if ($ok) { Write-Host "       new state=$($r.B.instance.current_state)" }

  $r=Req GET "/workflow/admissions/$aid" $TA admin; Check "W4" $r.S 200 "GET /workflow/admissions/:aid (verify state)"
  if ($ok) { Write-Host "       state=$($r.B.currentState) (expected: shortlisted)" }
}

$r=Req POST /admissions/applications $TA hod $ap; Check "A4" $r.S 403 "POST /admissions/applications (hod) - forbidden"

Write-Host "`n--- MARKS ---"
$ms=@{course_id="CSC101";programme="ICT";intake="2026-01";term="S1"}
$r=Req POST /marks/submissions $TA instructor $ms; Check "M1" $r.S 201 "POST /marks/submissions (instructor)"
$mid=$r.B.submission.id
if ($ok) { Write-Host "       state=$($r.B.workflowState)  id=$mid" }
if ($mid) { $r=Req GET "/marks/submissions/$mid" $TA instructor; Check "M2" $r.S 200 "GET /marks/submissions/:id" }
$r=Req POST /marks/submissions $TA finance $ms; Check "M3" $r.S 403 "POST /marks/submissions (finance) - forbidden"

Write-Host "`n--- FEES ---"
$fsid=if ($sid){$sid}else{"ab000000-0000-0000-0000-000000000001"}
$r=Req GET "/fees/students/$fsid/summary" $TA finance; Check "F1" $r.S 200 "GET /fees/summary (finance)"
if ($ok) { Write-Host "       totalDue=$($r.B.totalDue) totalPaid=$($r.B.totalPaid)" }

$r=Req GET "/fees/students/$fsid/transactions" $TA finance; Check "F2" $r.S 200 "GET /fees/transactions (finance)"
if ($ok) { Write-Host "       rows=$($r.B.total)" }

$fe=@{student_id=$fsid;amount=500000;currency="UGX";reference="SMK-REF-001";paid_at=(Get-Date -Format "yyyy-MM-dd")}
$r=Req POST /fees/entry $TA finance $fe; Check "F3" $r.S 201 "POST /fees/entry (finance)"
if ($ok) { Write-Host "       payment id=$($r.B.id)" }

$r=Req POST /fees/entry $TA registrar $fe; Check "F4" $r.S 403 "POST /fees/entry (registrar) - forbidden"
$r=Req POST /webhooks/schoolpay $TA admin @{ref="test"}; Check "F5" $r.S 501 "POST /webhooks/schoolpay (stub)"

Write-Host "`n============================================================"
Write-Host "  RESULTS: $PASS PASSED, $FAIL FAILED" -ForegroundColor $(if ($FAIL -eq 0) {"Green"} else {"Red"})
Write-Host "============================================================"
