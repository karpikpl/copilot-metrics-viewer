const fs = require('fs');
const path = require('path');
const fileName = 'organization_response_sample';

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname,`${fileName}.json`), 'utf8'));

console.log(`Got ${data.length} days`);

const converted = [];

for (const day of data) {
    console.log(`Day ${day.day}`);

    const newDay = {
        day: day.day,
        total_active_users: 0,
        total_engaged_users: day.total_active_users + day.total_active_chat_users,
        copilot_ide_code_completions: {
            total_engaged_users: 0, // sum of all the active users from the breakdown of ide
            editors: []
        },
        copilot_ide_chat: {
            total_engaged_users: day.total_active_chat_users,
            editors: []
        },
        copilot_dotcom_chat: dotcom_chat(),
        copilot_dotcom_pull_requests: dotcom_pull_requests()
    };

    for (const dataPoint of day.breakdown) {


        // assume that unknown language is chat
        if (dataPoint.language === 'unknown') {
            let editor = newDay.copilot_ide_chat.editors.find(e => e.name === dataPoint.editor)

            if (!editor) {
                editor = {
                    name: dataPoint.editor,
                    total_engaged_users: dataPoint.active_users,
                    models: [
                        {
                            name: "default",
                            is_custom_model: false,
                            custom_model_training_date: null,
                            total_engaged_users: dataPoint.active_users,
                            total_chats: dataPoint.suggestions_count,
                            total_chat_insertion_events: dataPoint.acceptances_count,
                            total_chat_copy_events: dataPoint.lines_accepted
                        }
                    ]
                }
                newDay.copilot_ide_chat.editors.push(editor);
            } else {
                editor.total_engaged_users += dataPoint.active_users;
                editor.models[0].total_engaged_users += dataPoint.active_users;
                editor.models[0].total_chats += dataPoint.suggestions_count;
                editor.models[0].total_chat_insertion_events += dataPoint.acceptances_count;
                editor.models[0].total_chat_copy_events += dataPoint.lines_accepted
            }

            continue;
        }

        let editor = newDay.copilot_ide_code_completions.editors.find(e => e.name === dataPoint.editor)
        newDay.total_active_users += dataPoint.active_users;

        if (!editor) {
            editor = {
                name: dataPoint.editor,
                total_engaged_users: dataPoint.active_users, // sum of all the active users from the breakdown of ide
                models: [
                    {
                        name: "default",
                        is_custom_model: false,
                        custom_model_training_date: null,
                        total_engaged_users: dataPoint.active_users,
                        languages: [
                            {
                                name: dataPoint.language,
                                total_engaged_users: dataPoint.active_users,
                                total_code_suggestions: dataPoint.suggestions_count,
                                total_code_acceptances: dataPoint.acceptances_count,
                                total_code_lines_suggested: dataPoint.lines_suggested,
                                total_code_lines_accepted: dataPoint.lines_accepted
                            }
                        ]
                    }
                ]
            }
            newDay.copilot_ide_code_completions.editors.push(editor);
        }
        else {
            // add to existing editor
            editor.total_engaged_users += dataPoint.active_users;

            // find the language
            const language = editor.models[0].languages.find(l => l.name === dataPoint.language);

            if (!language) {
                editor.models[0].languages.push({
                    name: dataPoint.language,
                    total_engaged_users: dataPoint.active_users,
                    total_code_suggestions: dataPoint.suggestions_count,
                    total_code_acceptances: dataPoint.acceptances_count,
                    total_code_lines_suggested: dataPoint.lines_suggested,
                    total_code_lines_accepted: dataPoint.lines_accepted
                });
            } else {
                language.total_engaged_users += dataPoint.active_users;
                language.total_code_suggestions += dataPoint.suggestions_count;
                language.total_code_acceptances += dataPoint.acceptances_count;
                language.total_code_lines_suggested += dataPoint.lines_suggested;
                language.total_code_lines_accepted += dataPoint.lines_accepted;
            }
        }

    }

    converted.push(newDay);
}

fs.writeFileSync(path.resolve(__dirname,`${fileName}.v2.json`), JSON.stringify(converted, null, 2));

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function dotcom_chat() {
    const total_engaged_users = randomInt(10, 100);

    return {
        total_engaged_users,
        models: [
            {
                name: "default",
                is_custom_model: false,
                custom_model_training_date: null,
                total_engaged_users,
                total_chats: randomInt(total_engaged_users * 2, total_engaged_users * 5),
            }
        ]
    };
}

function dotcom_pull_requests() {
    const total_engaged_users = randomInt(0, 27);
    const name = `demo/repo-${randomInt(5000, 6000)}`;
    const prs = {
        total_engaged_users,
        repositories: []
    }

    let usersLeft = total_engaged_users;

    while (usersLeft > 0) {
        const repo_users = randomInt(1, usersLeft);
        usersLeft -= repo_users;

        const repo = {
            name,
            total_engaged_users: repo_users,
            models: [
                {
                    name: "default",
                    is_custom_model: false,
                    custom_model_training_date: null,
                    total_pr_summaries_created: randomInt(repo_users * 2, repo_users * 5),
                    total_engaged_users: repo_users,
                }
            ]
        };

       prs.repositories.push(repo);
    }

    return prs;
}