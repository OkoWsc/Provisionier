const { SemVer } = require('semver');

semver=require('semver');

androidVersion="1.0.0";
iosVersion="2.0.0";
latestVersion=androidVersion;
if (semver.gt(iosVersion,androidVersion)) {
    version=iosVersion;
}

console.log(newMajorVersion,newMinorVersion,newPatchVersion);