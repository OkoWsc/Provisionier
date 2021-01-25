const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

getData = async function() {
    newVersion = "12.33.44";
    mainRef = await octokit.git.getRef({
        owner: "OkoWsc",
        repo: "provisionier",
        ref:  "heads/main"
    });
    mainSha = mainRef.data.object.sha;
    newBranch = await octokit.git.createRef({
        owner: "OkoWsc",
        repo: "provisionier",
        ref: `refs/heads/release-${newVersion}`,
        sha: mainSha
    });
    console.log(newBranch);
};
getData();