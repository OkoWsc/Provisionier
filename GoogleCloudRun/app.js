/**
 * @param {import('probot').Probot} app
 */

var admin = require('firebase-admin');
admin.initializeApp();
var db = admin.firestore();
const semver = require('semver');

const {Wit} = require('node-wit');
const witAiClient = new Wit({accessToken: process.env.witAiToken});


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
      try {
        witResponse = await witAiClient.message(context.payload.comment.body, {})
        console.log('Yay, got Wit.ai response: ' + JSON.stringify(witResponse));
      } catch (witError) {
        context.octokit.issues.createComment(
          context.issue({ body: `Sorry, i'm not feeling too well and cannot responsd.
            Please ask my maintainer to check the logs.` })
        );
        console.log("Got error from Wit.ai: ${witError}")
        throw new Error(witError);
      }

        witResponse.intents.sort(function(a, b) {
          if (a.confidence < b.confidence) return 1;
          if (a.confidence > b.confidence) return -1;
          return 0;
        });
        const highestIntent = witResponse.intents[0];
        console.log(`intent: ${highestIntent.name} with confidence: ${highestIntent.confidence}`);

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
          latestVersion=iosVersion;
      }

        switch (highestIntent.name) {
          case "setReleaseVersion":
            const existingReleaseBranch = await db.collection("apps")
              .doc(appReleaseInfo.id).collection("releases")
              .where("issue","==",context.payload.issue.id).get()
            if (!existingReleaseBranch.empty) {
              return context.octokit.issues.createComment(
                context.issue({ body: `Sorry, there's already an open release branch for this release.
                To change the version number close the issue and open a new one.` })
              );  
            }
            const releaseVersionEntities = witResponse.entities['semanticRelease:semanticRelease'];
            const selectedReleaseVersion = releaseVersionEntities[0].value;
            switch (selectedReleaseVersion) {
              case "major":
                newVersion = semver.inc(latestVersion,"major");
                break;
              case "minor":
                newVersion = semver.inc(latestVersion,"minor");
                break;
              case "patch":
                newVersion = semver.inc(latestVersion,"patch");
                break;
            }
            mainRef = await context.octokit.git.getRef({
              owner: context.payload.repository.owner.login,
              repo: context.payload.repository.name,
              ref:  "heads/main"
            });
            mainSha = mainRef.data.object.sha;
            branchName = `release-${newVersion}`;
            console.log(`Creating new branch: ${branchName} with commit: ${mainSha} from main branch`)
            newBranch = await context.octokit.git.createRef({
              owner: context.payload.repository.owner.login,
              repo: context.payload.repository.name,
              ref: `refs/heads/${branchName}`,
              sha: mainSha
            });
            console.log(newBranch);

            branchUrl = `/${context.payload.repository.owner.login}/
              ${context.payload.repository.name}/tree/${branchName}`

              await db.collection("apps")
              .doc(appReleaseInfo.id)
              .collection("releases")
              .doc().set({
                issue: context.payload.issue.id,
                branch: newBranch,
                releaseVersion: newVersion,
                baseCommit: mainSha,
                inProgress: true
              });


            context.octokit.issues.createComment(
              context.issue({ body: `I created a new branch for version: ${newVersion} [${branchName}](${branchUrl})
              Give me a minute to update the app.gradle and Info.plist version numbers.
              ` })
            );
            break;
          default:
            console.log(`Unrecognised intent: ${highestIntent.name} from wit.ai`);
            context.octokit.issues.createComment(
              context.issue({ body: `I don't understand what my hive mind colleages are asking me to do :(
                Please ask my maintainer to check the logs.` })
            );
            break;
        }
    } else {
      console.log("Not a release issue, nothing for me to do!");
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
          latestVersion=iosVersion;
      }
      nextMajorVersion = semver.inc(latestVersion,"major");
      nextMinorVersion = semver.inc(latestVersion,"minor");
      nextPatchVersion = semver.inc(latestVersion,"patch");

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
