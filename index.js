var app = require('express')();
var cookieParser = require('cookie-parser');
const m = require('moment');
const bodyParser = require('body-parser');
const db = require('./db');

const cors = require('cors');
const startTime = 8 * 60 + 30;
const endTime = 12 * 60 + 30;


let lastServed = 0;
let lastServedTime = time();
let lastServedDay = date();
let suggestions = [];

// parse application/json
app.use(bodyParser.json());

app.use(cookieParser());

app.use(cors());

function hr() {
	let d = m().add(5,'h').add(30,'m').format('HH');
	return d;
}

function mm() {
        let d = m().add(5,'h').add(30,'m').format('mm');
        return d;
}

function time(){
        let d = m().add(5,'h').add(30,'m').format('DDMMYYYY HH:mm:ss.SSS');
        return d;
}

function date(){
	let d = m().add(5,'h').add(30,'m').format('DDMMYYYY');
        return d;
}
app.get('/user/:status', async (req, res) => {
    //const type = body['type'] || 'v';
    //let status = type === 'v' ? [0,1] : [0,1,2];
    let status =[0,1];
    if(req.params.status === 'completed'){
        status = [1];
    } 
    const today = date();
    const results = await db.get(today,status,'v');
    res.json({results});
});

app.get('/suggestions', async (req, res) => {
    if(suggestions.length === 0){
        suggestions = await db.groceryList();
    }
    
    res.json(suggestions);
});

app.get('/user', (req, res) => {
    resetLastServedInfo();
	console.log(req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    console.log(`Last Served ${lastServed} ${lastServedDay} `);
    const user = {}, error = {};
    const uinfo = req.cookies.uinfo;
    if(typeof uinfo !== 'undefined'){
        const u = uinfo.split(';');
        if(u.length >= 3){
            user['mobile'] = u[0];
            user['tower'] = u[1];
            user['door'] = u[2];
        }
    }

    const now = Number(hr()) * 60 + Number(mm());
    console.log(`Now : ${now} ${hr()}`);
    const status = {}
    if(now >= startTime && now <= endTime){
        status['state'] = 'O';
    } else {
        error['state'] = true;
        error['msg'] = `Token system is not opened for new requests, available from 8:30 AM to 12:30 PM`;
        status['state'] = 'C';
    }
    res.json({error,user,status,last:{token:lastServed, time:lastServedTime}});
});

app.post('/grocery', async (req, res) => {

    const body = req.body;
    const error = {};
    if(typeof body['details'] === 'undefined' || Object.keys(body['details']) === 0){
        error['state'] = true;
        error['msg'] = `Please provide atleast one item to proceed`;
        return res.json({error});
    }
    const uinfo = req.cookies.uinfo;
    let cbre = false;
    if(typeof uinfo !== 'undefined'){
        const u = uinfo.split(';');
        if(u.length >= 3){
            body['mobile'] = u[0];
            body['tower'] = u[1];
            body['door'] = u[2];
            cbre = typeof u[3] !== undefined ? u[3] : false;
        }
    }    
    console.log(body);
    
    const today = date();
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const data = {day:today, mobile : body['mobile'], tower: body['tower'], door: body['door'], details: JSON.stringify(body['details']), time:`${cbre ? 'A' : ''} ${time()}`, alter:body['alternate']};
        const results = await db.bookGrocerySlot(data,ip,cbre);
        body['id'] = results.id;
        body['token'] = `Groc-${results.token}`;

        console.log(`=========> ${results.details}`);
        body['details'] = results.details !== null ? JSON.parse(results.details) : [];
        
    } catch(e) {
        console.log(e);
        error['state'] = true;
        error['msg'] = `System error`;
        return res.json({error});
    }

    res.json({error,user:body,last: {token:lastServed || 0, time:lastServedTime}});
});

app.post('/user', async (req, res) => {

    const body = req.body;
    const type = body['type'] || 'v';
    console.log(body);

    const error = {};
    const validError = isValid(body);
    if(Object.keys(validError).length > 0){
        error['msg'] = validError[Object.keys(validError)[0]];
        error['state'] = true;
        return res.json({error})
    }

    /*if(isReqNotAllowed(body['mobile'])){
        error['state'] = true;
        error['msg'] = 'Sorry, You can book veggie booking from 8:30 AM to 12:30 PM';
        return res.json({error});
    }*/
    const cbre = body['mobile'][0] === '#'; 
    body['door'] = body['door'].length === 3 ? `0${body['door']}` : body['door'];
    body['mobile'] = body['mobile'][0] === '#' ? body['mobile'].substring(1) : body['mobile'];
    
    const today = date();
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if(type === 'v'){
            const results = await db.bookSlot(today, body['mobile'], body['tower'], body['door'], ip, `${cbre ? 'A' : ''} ${time()}`, cbre);
            body['id'] = results.id;
            body['token'] = `Veg-${results.token}`;
        } else {
            const data = {day:today, mobile : body['mobile'], tower: body['tower'], door: body['door']};
            const results = await db.restrictIP(data,ip, cbre);
            if(results.token){
                body['token'] = results.token;
                body['id'] = results.id;
                body['details'] = results.details !== null ? JSON.parse(results.details) : [];
                body['alternate'] = results.alternate !== null ? results.alternate : cbre;
            }
        }
    } catch(e) {
        console.log(e);
        error['state'] = true;
        error['msg'] = e.message === 'IP' ? `You cannot book more than 2 apartments a day. Please talk to helpdesk for assistance`: `System error`;
        return res.json({error});
    }

    const newUser = `${body['mobile']};${body['tower']};${body['door']};${cbre}`;
    
    res.cookie('uinfo',newUser, { expires: new Date(Date.now() + (endTime-startTime) * 60 * 1000), httpOnly: true });
    res.json({error,user:body,last: {token:lastServed || 0, time:lastServedTime}});
});

app.put('/user', async (req,res) => {
    
    const body = req.body;
    const table = body['type'] || 'v';
    const call = body['called'] || 1;
    const today = date();
    if(body.type === 'call'){
	
        try{
            const result = await db.called(call, today,body.id,body.token, time(), type);

            if(today === lastServedDay){
                lastServed = Math.max(result, lastServed || 0);
            } else {
                lastServedDay = today;
                lastServed = 0;
            }
            lastServedTime = time();
            return res.json({error:{state:false}, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else if(body.type === 'complete'){
        try{
            await db.completed(1, today,body.id,body.token);
            return res.json({error:false, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else if(body.type === 'ready'){
        try{
            await db.completed(2, today,body.id,body.token);
            return res.json({error:false, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else {
        return res.json({error:{state:true, msg:'Unsupported type'}})
    }
});

app.put('/user/revert', async (req,res) => {

    const type = body['type'] || 'v';
    const call = body['called'] || 0;
    const body = req.body;
    const today = date();
    if(body.type === 'call'){
        try{
            await db.called(call, today,body.id,body.token, type);
            return res.json({error:{state:false}, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else if(body.type === 'complete'){
        try{
            await db.completed(call, today,body.id,body.token,type);
            return res.json({error:false, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else {
        return res.json({error:{state:true, msg:'Unsupported type'}})
    }
});

function isValid(body){
    if(typeof body['mobile'] === 'undefined' || typeof body['tower'] === 'undefined' ||  typeof body['door'] === 'undefined' || body['mobile'].length === 0 || body['door'].length === 0){
        return {parameter: 'Empty Parameter'};
    }
    const mobile = body['mobile'][0] === '#' || body['mobile'][0] === '0' ? body['mobile'].substring(1) : body['mobile'];
    if(mobile.length !== 10){
        return {mobile: 'Invalid mobile number'};
    }

    if(body['door'].length !== 3 && body['door'].length !== 4){
        return {door: 'Door number is invalid'};
    }

    const door = body['door'].length === 3 ? '0'+body['door'] : body['door'];
    const eachDigit = door.split('');
    if(Number(eachDigit[0]) !== 0 && Number(eachDigit[0]) !== 1){
        return {door: 'Door number is invalid'};
    }

    if(Number(eachDigit[0]) === 1 && Number(eachDigit[1]) > 3){
        return {door: 'Door number is invalid'};
    }

    if(Number(eachDigit[2]) !== 0){
        return {door: 'Door number is invalid'};
    }

    const eightHousesTower = 'DeodarCasuarinaGulmoharMulberry';
    if(!eightHousesTower.includes(body['tower']) && Number(eachDigit[3]) > 4){
        return {door: 'Door number is invalid'};
    }

    if(eightHousesTower.includes(body['tower']) && Number(eachDigit[3]) > 8){
        return {door: 'Door number is invalid'};
    }

    return {};
}

function isReqNotAllowed(mobile){
   if(mobile[0] === '#'){
	return false;
   }
   const now = Number(hr()) * 60 + Number(mm());
   console.log(`Now : ${now} ${hr()}`);
   const status = {}
   if(now >= startTime && now <= endTime){
       return false;
   }
   return true;
}

var server = app.listen(7001 ,async function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Running at %s', port);
    
    const today = date();
    const ls = await db.lastServed(today,'v',1);
    console.log(`${today} ${ls.token} ${ls.time}`);
    if(ls.token === 0){
        resetLastServedInfo();
    } else {
        lastServed = ls.token;
        lastServedTime = ls.time;
    }
    suggestions = await db.groceryList();
});

function resetLastServedInfo(){
    const today = date();
    if(lastServedDay !== today){
        lastServed = 0;
        lastServedTime = '01012020 08:30:00';
        lastServedDay = today;
        console.log(`RESET Loaded Last Served ${lastServed} ${lastServedTime}`);
    }
}

function randomUniqueTokens(num=4, max=20){
    const results = [];
    while(results.length !== num){
        let ran = Math.round(Math.random() * max);
        if(results.filter(s => s === ran).length === 0){
            results.push(ran);
        }
    }
    return results;
}
