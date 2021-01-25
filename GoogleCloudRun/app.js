/**
 * @param {import('probot').Probot} app
 */

var admin = require('firebase-admin');
admin.initializeApp();
var db = admin.firestore();
const semver = require('semver');

const permissionCheck = async function(context) {
  const permissions =await context.octokit.repos.getCollaboratorPermissionLevel({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    username: context.payload.sender.login
  })

  const permission = permissions.data.permission;
  console.log(`User has role: ${permission}`)
  switch (permission) {
    case "admin":
    case "write":
      return true;
      break;
    default:
      return false;
  }
}
module.exports = (app) => {
  console.log("Yay! The app was loaded!");

  app.on("issue_comment.created", async (context) => {
    console.log("New comment received");
    console.log(context.payload);

    if (!await permissionCheck(context)) {
      return console.log("Commenting user not got permission");
    }

    const releaseLabel = context.payload.issue.labels.filter(function(label) {
      return label.name == "release";
    })
    if (releaseLabel) {
      console.log("This comment is on a release issue");
      // @todo add wit.ai here
      context.octokit.issues.createComment(
        context.issue({ body: JSON.stringify(context.payload) })
      );
    } else {
      console.log("Not a release issue");
      context.octokit.issues.createComment(
        context.issue({ body: `NOTREL:${JSON.stringify(context.payload)}` })
      );
    }
});

  app.on("issues.opened", async (context) => {
    console.log("New issue opened");
    console.log(JSON.stringify(context.payload));


    const releaseLabel = context.payload.issue.labels.filter(function(label) {
      return label.name == "release";
    })
    if (releaseLabel) {
      console.log("Issue is release issue");
  
      if (!await permissionCheck(context)) {
        await context.octokit.issues.createComment(
          context.issue({ body: `I don't recognise you`})
        );
  
        return context.octokit.issues.update(
          context.issue({state:"closed"})
        )  
      }

      const appReleaseInfoDocs = await db.collection("apps")
        .where("owner","==",context.payload.repository.owner.login)
        .where("repo","==",context.payload.repository.name)
        .get();
      if (appReleaseInfoDocs.empty) {
        await context.octokit.issues.createComment(
          context.issue({ body: `I couldn't find a configured app for this repo :(`})
        );

        return context.octokit.issues.update(
          context.issue({state:"closed"})
        )
      }
      appReleaseInfo = appReleaseInfoDocs.docs[0].data();
      appReleaseInfo.id = appReleaseInfoDocs.docs[0].id;
      androidVersion=appReleaseInfo.androidVersion;
      iosVersion=appReleaseInfo.iosVersion;

      latestVersion=androidVersion;
      if (semver.gt(iosVersion,androidVersion)) {
          version=iosVersion;
      }
      nextMajorVersion = semver.inc(version,"major");
      nextMinorVersion = semver.inc(version,"minor");
      nextPatchVersion = semver.inc(version,"patch");

      return context.octokit.issues.createComment(
        context.issue({ body: `Hi @${context.payload.issue.user.login}
          Currently deployed Android: ${androidVersion}
          Currently deployed iOS: ${iosVersion}
          Next major: ${nextMajorVersion}
          Next minor: ${nextMinorVersion}
          Next patch: ${nextPatchVersion}
          To set the version for this release reply saying /setVersion major, minor or patch
          (eg /setVersion minor)`})
      );
    } else {
      console.log("Issue is not release issue, ignoring")
      return;
    }
  });
};
