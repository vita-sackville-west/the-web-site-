const fs = require('fs');
let p = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');

console.log('File length:', p.length);

// Check if CocoaPods is in there
const hasCP = p.includes('[CP] Embed Pods Frameworks');
console.log('Has Embed Pods Frameworks:', hasCP);

// Find and show the context
const idx = p.indexOf('[CP]');
if(idx > -1) {
  console.log('Context:', p.substring(idx-100, idx+200));
}

// Try different removal approaches
p = p.replace(/[A-F0-9a-f]{24} \/\* \[CP\] Embed Pods Frameworks \*\/,?\r?\n/g, '');
p = p.replace(/[A-F0-9a-f]{24} \/\* \[CP\] Embed Pods Frameworks \*\/ \*\/,?\r?\n/g, '');

const stillHasCP = p.includes('[CP] Embed Pods Frameworks');
console.log('Still has after replace:', stillHasCP);

fs.writeFileSync('ios/App/App.xcodeproj/project.pbxproj', p);
console.log('saved');