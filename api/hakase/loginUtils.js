
const PWD_SP = process.env.HAKASE_PASSWORD_SPECTATOR;
const PWD_ED = process.env.HAKASE_PASSWORD_EDITOR;
const TOK_SP = process.env.HAKASE_ACCESS_TOKEN_SPECTATOR;
const TOK_ED = process.env.HAKASE_ACCESS_TOKEN_EDITOR;

export function roleByPassword(hash){
	switch(hash){
	case (PWD_SP):
		return 0;
	case (PWD_ED):
		return 1;
	default:
		return -1;
	}
}

export function roleByToken(token){
	switch(token){
	case (TOK_SP):
		return 0;
	case (TOK_ED):
		return 1;
	default:
		return -1;
	}
}