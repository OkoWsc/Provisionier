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


    const permissions =await context.octokit.repos.getCollaboratorPermissionLevel({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      username: context.payload.sender.login
    })
    const permission = permissions.data.permission;
    console.log(`User has role:${permission}`)
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

    const releaseLabel = context.payload.issue.labels.filter(function(label) {
      return label.name == "release";
    })
    if (releaseLabel) {
      console.log("Issue is release issue");
      return context.octokit.issues.createComment(
        context.issue({ body: `Hi @${context.payload.issue.user.login}
          Currently deployed Android: x.x.x
          Currently deployed iOS: x.x.x
          
          To set the version for this release reply saying /setVersion n.n.n
          where n.n.n is the version number for this release.`})
      );
    } else {
      console.log("Issue is not release issue, ignoring")
      return;
    }
  });
};
