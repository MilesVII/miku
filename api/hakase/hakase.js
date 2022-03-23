import { setUncaughtExceptionCaptureCallback } from 'process';

const https = require('https');
const ira = require("./gamagori.js");

const HOST = process.env.HAKASE_HOST;
const AUTH_TOKEN = process.env.HAKASE_YOUTRACK_TOKEN;
const TOK_SP = process.env.HAKASE_ACCESS_TOKEN_SPECTATOR;
const TOK_ED = process.env.HAKASE_ACCESS_TOKEN_EDITOR;

async function loadOverview(){
	function recentUpdated(issue) {
		let mostRecent = issue.updated;
		for (let i of issue.subtasks.issues){
			if (i.updated > mostRecent){
				mostRecent = i.updated;
			}
		}
		return mostRecent;
	}
	function formatIssue(issue){
		let fields = {
			summary: issue.summary || "",
			assignee: "",
			status: "",
			priority: "",
			resolved: issue.resolved ? true : false,
			id: issue.idReadable
		}
		for (let fulda of issue.fields){
			if (fulda.name == "Assignee") fields.assignee = fulda?.value?.name;
			if (fulda.name == "Status") fields.status     = fulda?.value?.name;
			if (fulda.name == "Priority") fields.priority = fulda?.value?.name;
		}
		return fields;
	}
	function restoreBrackets(name){
		if (!name.startsWith("["))
			return `[${name}]`;
		else
			return name;
	}

	let fwoosh = [
		ira.listIssues(HOST, AUTH_TOKEN, ira.FIELDS_DEFAULT_EPIC),
		ira.listIssues(HOST, AUTH_TOKEN, ira.FIELDS_QA)
	];
	let smash = await Promise.all(fwoosh);
	let epics = smash[0];
	epics.sort((a, b) => recentUpdated(a) > recentUpdated(b));
	let bugIssues = smash[1];

	let result = [];
	for (let e of epics){
		let heap = e.subtasks.issues.map(i => formatIssue(i));
		let designLink = "";
		let additionalLinks = [];

		let dates = "";
		if (e.description){
			let lines = e.description.split("\n").map(l => l.trim());
			for (let line of lines){
				if (line.includes("figma") ||
				    line.includes("http") ||
				    line == "")
					continue;
				dates = line;
				break;
			}
			
			e.description.match(/\bhttp\S*/g)?.forEach(link => {
				if (link.includes("figma")){
					if (!designLink){
						designLink = link;
					}
				} else 
					additionalLinks.push(link);
			});
		}

		let bugs = bugIssues
			.filter(i => i.summary.toLowerCase().includes(e.summary.toLowerCase()))
			.map(i => formatIssue(i));

		result.push({
			epic: restoreBrackets(e.summary),
			card: formatIssue(e),
			issues: heap,
			dates: dates,
			bugs: bugs, 
			project: e.project?.name,
			designLink: designLink,
			link: HOST + "/issue/" + e.idReadable,
			additionalLinks: additionalLinks
		});
	}
	
	return result;
}

export default function handler(request, response) {
	if ([TOK_SP, TOK_ED].includes(request.cookies.access))
		loadOverview().then(r => response.status(200).send(r));
	else
		response.status(401).end();
}