/**
 * @param {import('probot').Probot} app
 */

var admin = require('firebase-admin');
admin.initializeApp();
var db = admin.firestore();

module.exports = (app) => {
  console.log("Yay! The app was loaded!");

  app.on("issues.opened", async (context) => {
    console.log("New issue opened");
    console.log(JSON.stringify(context.payload));


    const releaseLabel = context.payload.issue.labels.filter(function(label) {
      return label.name == "release";
    })
    if (releaseLabel) {
      console.log("Issue is release issue");
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
          break;
        default:
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
      appReleaseInfo = appReleaseInfoDocs.docs[0].data;
      appReleaseInfo.id = appReleaseInfoDocs.docs[0].id;

      return context.octokit.issues.createComment(
        context.issue({ body: `Hi @${context.payload.issue.user.login}
          Currently deployed Android: ${appReleaseInfo.androidVersion}
          Currently deployed iOS: ${appReleaseInfo.iosVersion}
          
          To set the version for this release reply saying /setVersion n.n.n
          where n.n.n is the version number for this release.`})
      );
    } else {
      console.log("Issue is not release issue, ignoring")
      return;
    }
  });
};
