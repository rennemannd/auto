import { getInput } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { request } from '@octokit/request'

const pr = context.payload.pull_request;
const client = getOctokit(getInput("repo_token"));
//const slackToken = core.getInput("slack_token");

run();

async function run() {
    // verify the pull request was merged
    if(!pr.merged) {
        console.log("Closed pr onto master was not merged, aborting action");
        return;
    }

    try {
        let isRelease = pr.head.ref.match(/release/gi);
        if (isRelease) {
            let version = pr.head.ref.match(/(?:v\s?)(\d+.?)+/gi)[0];

            await postTag(version);

        }  else {
            console.log("This was a merge to master which was not a release, attempting to increment patch version.");

            await _exec("git fetch --prune --unshallow --tags");
            const previousTagSha = (await _exec("git rev-list --tags --topo-order --max-count=1")).stdout.trim();
            let tag = (await _exec(`git describe --tags ${previousTagSha}`)).stdout.trim();

            let regTag = tag.match(/(\d+.\d+).?(\d+)?/i);
            let newVersion;

            if(regTag[2]) {
                let newPatch = parseInt(regTag[2], 10) + 1;
                newVersion = regTag[1] + "." + newPatch.toString()
            } else {
                newVersion = regTag[1] + ".1";
            }

            await postTag(newVersion);
        }
    } catch (error) {
        console.log(error.message);
    }
}

async function postTag(ver) {
    console.log(`Creating annotated tag`);

    const tagCreateResponse = await client.git.createTag({
        ...context.repo,
        tag: ver,
        message: pr.body,
        object: context.sha,
        type: "commit",
    });

    console.log(`Pushing annotated tag to the repo`);

    let response = await client.git.createRef({
        ...context.repo,
        ref: `refs/tags/${ver}`,
        sha: tagCreateResponse.data.sha,
    });

    console.log("Tag should be created, response was: \n\n", response);
}

async function _exec(command) {
    let stdout = "";
    let stderr = "";

    try {
        const options = {
            listeners: {
                stdout: (data) => {
                    stdout += data.toString();
                },
                stderr: (data) => {
                    stderr += data.toString();
                },
            },
        };

        const code = await exec(command, undefined, options);

        return {
            code,
            stdout,
            stderr,
        };
    } catch (err) {
        return {
            code: 1,
            stdout,
            stderr,
            error: err,
        };
    }
}