const mysql      = require('mysql');
const dbConfig = {
    host     : 'SG-LT-2114-master.servers.mongodirector.com',
    user     : 'sgroot',
    password : '',
    database : 'lt'
  };

  async function bookSlot(day, mobile, tower, door, ip, time, cbre){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        const user = {mobile, tower, door};
        await connection.query({
            sql : `SELECT * FROM veggie WHERE day = ? and tower = ? and door = ?`,
            values : [day, tower, door]
        }, async (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }

            if(results.length !== 0){
                user['token'] = results[0].token;
                user['id'] = results[0].id;
                connection.end();
                return resolve(user);
            } 

            if(cbre){
                await connection.query({
                    sql : `SELECT max(token) as token FROM veggie WHERE day = ?`,
                    values : [day]
                }, async (error1, results1) => {
                    if(error1){
                        console.log(error1);
                        connection.end();
                        return reject(error1);
                    }
                    const token = (results1.length > 0 ? results1[0]['token'] : 0) + 1;
                    await connection.query({
                        sql : `insert into veggie(day,mobile,tower,door,token,ip, time) values (?,?,?,?,?,?,?)`,
                        values : [day, mobile, tower, door, token, ip, time]
                    }, (error2, results2) => {
                        if(error2){
                            console.log(error2);
                            connection.end();
                            return reject(error2);
                        }
                        user['token'] = token;
                        user['id'] = results2.insertId;
                        resolve(user);
                        connection.end();
                    });
                });
            } else {
                await connection.query({
                    sql : `SELECT * FROM veggie WHERE day = ? and ip = ?`,
                    values : [day, ip]
                }, async (error5, results5) => {
                    if(error5){
                        console.log(error5);
                        connection.end();
                        return reject(error5);
                    }
                    if(results5.length >= 2){
                        console.log('Reached max IP restrictions '+ip);
                        connection.end();
                        return reject(new Error('IP'));
                    }
                
                    await connection.query({
                        sql : `SELECT max(token) as token FROM veggie WHERE day = ?`,
                        values : [day]
                    }, async (error1, results1) => {
                        if(error1){
                            console.log(error1);
                            connection.end();
                            return reject(error1);
                        }
                        const token = (results1.length > 0 ? results1[0]['token'] : 0) + 1;
                        await connection.query({
                            sql : `insert into veggie(day,mobile,tower,door,token,ip, time) values (?,?,?,?,?,?,?)`,
                            values : [day, mobile, tower, door, token, ip, time]
                        }, (error2, results2) => {
                            if(error2){
                                console.log(error2);
                                connection.end();
                                return reject(error2);
                            }
                            user['token'] = token;
                            user['id'] = results2.insertId;
                            resolve(user);
                            connection.end();
                        });
                    });
                });
            }
        });
    });
}

async function lastServed(day){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `SELECT max(token) as token FROM veggie WHERE day = ? and called = 1`,
            values : [day]
        }, (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            if(results.length > 0){
                resolve(results[0]['token']);
            } else {
                resolve(0);
            }
            connection.end();
        });
    });
}

async function called(val, day, id, token){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `update veggie set called= ? where day = ? and id = ? and token = ?`,
            values : [val,day, id, token]
        }, (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            resolve(token);
            connection.end();
        });
    });
}

async function completed(val, day, id, token){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `update veggie set complete= ? where day = ? and id = ? and token = ?`,
            values : [val, day, id, token]
        }, (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            resolve(token);
            connection.end();
        });
    });
}

async function get(day, status){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `select * from veggie where day = ? and complete in (?)`,
            values : [day, status]
        }, (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            const finalResults = [];
            results.forEach(e => {
                finalResults.push({
                    id: e.id,
                    mobile : e.mobile,
                    tower : e.tower,
                    door : e.door,
                    token : e.token,
                    called : e.called,
                    completed : e.complete
                });
            });
            resolve(finalResults);
            connection.end();
        });
    });
}

module.exports.bookSlot = bookSlot;
module.exports.lastServed = lastServed;
module.exports.called = called;
module.exports.completed = completed;
module.exports.get = get;
