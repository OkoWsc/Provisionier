/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log("Yay! The app was loaded!");

  app.on("issues.opened", async (context) => {
    console.log("New issue opened");
    console.log(JSON.stringify(context.payload));
    
    return context.octokit.issues.createComment(
      context.issue({ body: JSON.stringify(context.payload) })
    );
  });
};
