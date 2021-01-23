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

    const permissions =await myOctokit.repos.getCollaboratorPermissionLevel({
      owner: context.payload.repository.owner.username,
      repo: context.payload.repository.name,
      username: context.payload.sender.login
    })
    console.log(`User has role:${permissions.data.permission}`)

    const releaseLabel = context.payload.issue.labels.filter(function(label) {
      return label.name == "release";
    })
    if (releaseLabel) {
      console.log("Issue is release issue");
      return context.octokit.issues.createComment(
        context.issue({ body: `
          Hi @${context.payload.issue.user.login}
          Latest android version: x.x.x
          Latest iOS version: x.x.x
          
          To set the version for this release reply saying /setVersion n.n.n
          where n.n.n is the version number for this release.
        ` })
      );
    } else {
      console.log("Issue is not release issue, ignoring")
      return;
    }
  });
};
