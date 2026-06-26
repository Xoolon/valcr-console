$Package = Split-Path -Parent $MyInvocation.MyCommand.Path
$Source = Join-Path $Package 'frontend'
$Project = 'C:\Users\NOMAD\PycharmProjects\valero\console-frontend'

$files = @(
  'src\App.jsx',
  'src\main.jsx',
  'src\pages\Auth.jsx',
  'src\pages\Billing.jsx',
  'src\components\TurnstileWidget.jsx',
  'src\contexts\AuthContext.jsx',
  'src\utils\session.js',
  'src\utils\http.js',
  'src\utils\authApi.js',
  'src\utils\billingApi.js'
)

foreach ($relative in $files) {
  $from = Join-Path $Source $relative
  $to = Join-Path $Project $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
  Copy-Item -Force $from $to
  Write-Host "Copied $relative"
}

Copy-Item -Force (Join-Path $Source '.env.production.example') (Join-Path $Project '.env.production.example')
Copy-Item -Force (Join-Path $Source '.env.local.example') (Join-Path $Project '.env.local.example')

Write-Host ''
Write-Host 'Frontend files copied.' -ForegroundColor Green
Write-Host 'Create .env.local or .env.production and insert the real Turnstile SITE key before building.'
