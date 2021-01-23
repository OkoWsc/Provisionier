/**
 * @param {import('probot').Probot} app
 */

var admin = require('firebase-admin');
admin.initializeApp();
var db = admin.firestore();

module.exports = (app) => {
  app.log("Yay! The app was loaded!");

  const router = getRouter("/app");
  router.get("/ping", (req, res) => {
    res.send("pong");
  });

  app.on("issues.opened", async (context) => {
    console.log("New issue opened");
    console.log(JSON.stringify(context.payload));

    const permissions = await context.octokit.repos.getCollaboratorPermissionLevel({
      owner: context.payload.repository.owner.login,
      repository: context.payload.repository.full_name,
      username: context.payload.issue.user.login
    });
    console.log(`Got permissions: ${permissions}`)

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
          ${JSON.stringify(permissions)}
        ` })
      );
    } else {
      console.log("Issue is not release issue, ignoring")
      return;
    }
  });
};
