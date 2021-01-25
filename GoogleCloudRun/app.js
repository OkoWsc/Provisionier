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


        witResponse.intents.sort(function(a, b) {
          if (a.confidence < b.confidence) return 1;
          if (a.confidence > b.confidence) return -1;
          return 0;
        });
        const highestIntent = witResponses.intents[0];
        console.log(`intent: ${highestIntent.name} with confidence: ${highestIntent.confidence}`);
        switch (highestIntent.name) {
          case "setReleaseVersion":
            const releaseVersionEntities = witResponse.entities['semanticRelease:semanticRelease'];
            const selectedReleaseVersion = releaseVersionEntities[0].value;
            context.octokit.issues.createComment(
              context.issue({ body: `I should probably set the release version to: ${selectedReleaseVersion}` })
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
      } catch (witError) {
        context.octokit.issues.createComment(
          context.issue({ body: `Sorry, i'm not feeling too well and cannot responsd.
            Please ask my maintainer to check the logs.` })
        );
        throw new Error(witError);
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
