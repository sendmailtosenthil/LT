var app = require('express')();
var cookieParser = require('cookie-parser');
const m = require('moment');
const bodyParser = require('body-parser');
const db = require('./db');

const startTime = 4;
const endTime = 6;

let lastServed = 0;
let lastServedDay = '01012020';

// parse application/json
app.use(bodyParser.json());

app.use(cookieParser());

app.get('/user/:status', async (req, res) => {
    let status = [0,1];
    if(req.params.status === 'completed'){
        status = [1];
    } 
    const today = m().format('DDMMYYYY');
    const results = await db.get(today,status);
    res.json({results});
});

app.get('/user', (req, res) => {
    console.log(`Last Served ${lastServed} ${lastServedDay}`);
    const user = {}, error = {};
    const uinfo = req.cookies.uinfo;
    if(typeof uinfo !== 'undefined'){
        const multiUInfo = uinfo.split('|');
        //console.log(multiUInfo);
        let uData = '';
        if(multiUInfo.length > 0){
            const len = multiUInfo.length;
            //console.log(multiUInfo[len - 1]);
            uData = multiUInfo[len - 1].length > 0 ? multiUInfo[len - 1]: multiUInfo[len - 2];
        }
        console.log(uData);
        if(uData.length > 0){
            const u = uData.split(';');
            //console.log(u.length+'::'+u);
            if(u.length === 3){
                user['mobile'] = u[0];
                user['tower'] = u[1];
                user['door'] = u[2];
            }
        }
    }

    const now = Number(m().format('HH'));
    //console.log(now);
    const status = {}
    if(now >= startTime && now < endTime){
        status['state'] = 'O';
    } else {
        error['state'] = true;
        error['msg'] = `Token system is not opened for new requests, available from ${startTime} AM to ${endTime - 12} PM`;
        status['state'] = 'C';
    }
    res.json({error,user,status});
});

app.post('/user', async (req, res) => {
    console.log(`Post Last Served ${lastServed} ${lastServedDay}`);
    const body = req.body;
    console.log(body);

    const error = {};
    const validError = isValid(body);
    if(Object.keys(validError).length > 0){
        error['msg'] = validError[Object.keys(validError)[0]];
        error['state'] = true;
        return res.json({error})
    }
    let uinfo = req.cookies.uinfo;
    if(typeof uinfo !== 'undefined'){
        const multiUInfo = uinfo.split('|');
        if(multiUInfo.length > 1 && !uinfo.includes(`${body['tower']};${body['door']}`)){
            error['state'] = true;
            error['msg'] = `Right now, user can book slot for maximum 2 slots. Booked for ${multiUInfo[0].split(';').slice(1)} ${multiUInfo[1].split(';').slice(1)}`;
            return res.json({error});
        } 
    }
    
    const today = m().format('DDMMYYYY');
    try{
        const results = await db.bookSlot(today, body['mobile'], body['tower'], body['door']);
        body['id'] = results.id;
        body['token'] = results.token;
    }catch(e){
        console.log(e);
        error['state'] = true;
        error['msg'] = `System error`;
        return res.json({error});
    }

    const newUser = `${body['mobile']};${body['tower']};${body['door']}`;
    let newCookie = '';
    if(typeof uinfo !== 'undefined'){
        if(uinfo.includes(`${body['tower']};${body['door']}`)){
            newCookie = uinfo;
        } else {
            newCookie = `${uinfo}|${newUser}`;
        }
    } else {
        newCookie = `${newUser}`;
    }

    res.cookie('uinfo',newCookie, { expires: new Date(Date.now() + (endTime-startTime) * 60 * 60 * 1000), httpOnly: true });
    res.json({error,user:body,lastServed: lastServed || 0});
});

app.put('/user', async (req,res) => {
    console.log(`Put Last Served ${lastServed} ${lastServedDay}`);
    const body = req.body;
    
    const today = m().format('DDMMYYYY');
    if(body.type === 'call'){
        try{
            const result = await db.called(1, today,body.id,body.token);
            if(today === lastServedDay){
                lastServed = Math.max(result, lastServed || 0);
            } else {
                lastServedDay = today;
                lastServed = 0;
            }
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
    } else {
        return res.json({error:{state:true, msg:'Unsupported type'}})
    }
});

app.put('/user/revert', async (req,res) => {
    console.log(`Put Last Served ${lastServed} ${lastServedDay}`);
    const body = req.body;
    const today = m().format('DDMMYYYY');
    if(body.type === 'call'){
        try{
            const result = await db.called(0, today,body.id,body.token);
            if(today === lastServedDay){
                lastServed = Math.max(result, lastServed || 0);
            } else {
                lastServedDay = today;
                lastServed = 0;
            }
            return res.json({error:{state:false}, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else if(body.type === 'complete'){
        try{
            await db.completed(0, today,body.id,body.token);
            return res.json({error:false, user: body});
        } catch (e){
            return res.json({error:{state:true, msg : e.message}, user:body});
        }
    } else {
        return res.json({error:{state:true, msg:'Unsupported type'}})
    }
});

function isValid(body){
    if(typeof body['mobile'] === 'undefined' || typeof body['tower'] === 'undefined' ||  typeof body['door'] === 'undefined'){
        return {parameter: 'Empty Parameter'};
    }
    if(body['mobile'].length !== 10){
        return {mobile: 'Invalid number, should be of 10 chars'};
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

    if(Number(eachDigit[3]) > 8){
        return {door: 'Door number is invalid'};
    }
    if(Number(eachDigit[3]) === 0){
        return {door: 'Door number is invalid'};
    }

    return {};
}

var server = app.listen(7001 ,async function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Running at %s', port);
    
    const today = m().format('DDMMYYYY');
    lastServed = await db.lastServed(today);

    lastServedDay = today;
});