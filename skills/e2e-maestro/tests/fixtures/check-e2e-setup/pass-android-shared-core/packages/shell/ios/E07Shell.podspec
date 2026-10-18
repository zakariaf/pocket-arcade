# packages/shell/ios/E07Shell.podspec
Pod::Spec.new do |s|
  s.name           = 'E07Shell'
  s.version        = '1.0.0'
  s.summary        = 'Native helpers of the E07 Shell'
  s.author         = 'e07'
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
