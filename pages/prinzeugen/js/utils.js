function chunk(a, chunksize){
	let r = [];
	for (let i = 0; i < a.length; i += chunksize){
		r.push(a.slice(i, i + chunksize));
	}
	return r;
}

function sleep(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

function gbToUnix(raw){
	const r = raw.split(" ")
	const fixed = `${r[2]} ${r[1]} ${r[5]} ${r[3]} GMT`;
	return Date.parse(fixed);
}

function load(key){
	return JSON.parse(localStorage.getItem(key) || "null");
}

function save(key, data){
	localStorage.setItem(key, JSON.stringify(data));
}