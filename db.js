const mysql      = require('mysql');
/*const dbConfig = {
    host     : 'SG-LT-2114-master.servers.mongodirector.com',
    user     : 'sgroot',
    password : 'u1!WkQ5n3NJPnGM7',
    database : 'lt'
  };
*/
const dbConfig = {
    host     : 'localhost',
    user     : 'root',
    password : 'MyNewPass',
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
                    sql : `insert into veggie(day,mobile,tower,door,token,ip, time) 
                    values (?,?,?,?,(select id +1 from (SELECT COALESCE(max(token),0) as id FROM veggie WHERE day = ?) t),?,?)`,
                    values : [day, mobile, tower, door, day, ip, time]
                }, async (error2, results2) => {
                    if(error2){
                        console.log(error2);
                        connection.end();
                        return reject(error2);
                    }
                    await connection.query({
                        sql : `SELECT token as token FROM veggie WHERE id = ?`,
                        values : [results2.insertId]
                    }, async (error1, results1) => {
                        if(error1){
                            console.log(error1);
                            connection.end();
                            return reject(error1);
                        }
                        const token = (results1.length > 0 ? results1[0]['token'] : 0);
                        user['token'] = token;
                        user['id'] = results2.insertId;
                        resolve(user);
                        connection.end();
                    });
                });
            } else {
                await connection.query({
                    sql : `SELECT ip FROM veggie WHERE day = ? and ip = ?`,
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
                        sql : `insert into veggie(day,mobile,tower,door,token,ip, time) 
                        values (?,?,?,?,(select id +1 from (SELECT COALESCE(max(token),0) as id FROM veggie WHERE day = ?) t),?,?)`,
                        values : [day, mobile, tower, door, day, ip, time]
                    }, async (error2, results2) => {
                        if(error2){
                            console.log(error2);
                            connection.end();
                            return reject(error2);
                        }
                        await connection.query({
                            sql : `SELECT token as token FROM veggie WHERE id = ?`,
                            values : [results2.insertId]
                        }, async (error1, results1) => {
                            if(error1){
                                console.log(error1);
                                connection.end();
                                return reject(error1);
                            }
                            const token = (results1.length > 0 ? results1[0]['token'] : 0);
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

async function lastServed(day, type, called){
    
    const table = type === 'v' ? 'veggie' : 'daily_grocery';
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `SELECT token, calledtime FROM ${table} where token = (SELECT max(token) as token FROM ${table} WHERE day = ? and called = ?) and day=?`,
            values : [day, called, day]
        }, (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            if(results.length > 0){
                resolve({token: results[0]['token'], time:results[0]['calledtime']});
            } else {
                resolve({token:0});
            }
            connection.end();
        });
    });
}

async function called(val, day, id, token, calledtime, type){
    
    const table = type === 'v' ? 'veggie' : 'daily_grocery';
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `update ${table} set called= ?, calledtime = ? where day = ? and id = ? and token = ?`,
            values : [val, calledtime, day, id, token]
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

async function completed(val, day, id, token,type){
    
    const table = type === 'v' ? 'veggie' : 'daily_grocery';
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `update ${table} set complete= ? where day = ? and id = ? and token = ?`,
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

async function get(day, status, type){
    
    const table = type === 'v' ? 'veggie' : 'daily_grocery';
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `select * from ${table} where day = ? and complete in (?)`,
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
                    token : `${type === 'v' ? 'Veg-' : 'Groc-'}${e.token}`,
                    called : e.called,
                    completed : e.complete,
                    details: e.details
                });
            });
            resolve(finalResults);
            connection.end();
        });
    });
}

async function bookGrocerySlot(i, ip){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        const user = {mobile:i.mobile, tower:i.tower, door:i.door, details:i.details, alternate: i.alter};
        await connection.query({
            sql : `SELECT * FROM daily_grocery WHERE day = ? and tower = ? and door = ?`,
            values : [i.day, i.tower, i.door]
        }, async (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }

            if(results.length !== 0){
                user['token'] = results[0].token;
                user['id'] = results[0].id;
                user['details'] = results[0].data;
                user['alternate'] = results[0].alternate;
                connection.end();
                return resolve(user);
            } 
            await connection.query({
                sql : `insert into daily_grocery(day,mobile,tower,door,token,ip, time, data, alternate) 
                    values (?,?,?,?,(select id +1 from (SELECT COALESCE(max(token),0) as id FROM veggie WHERE day = ?) t),?,?,?,?)`,
                values : [i.day, i.mobile, i.tower, i.door, i.day, ip, i.time, i.details,i.alter]
            }, async (error2, results2) => {
                if(error2){
                    console.log(error2);
                    connection.end();
                    return reject(error2);
                }
                await connection.query({
                    sql : `SELECT token as token FROM daily_grocery WHERE id = ?`,
                    values : [results2.insertId]
                }, async (error1, results1) => {
                    if(error1){
                        console.log(error1);
                        connection.end();
                        return reject(error1);
                    }
                    const token = (results1.length > 0 ? results1[0]['token'] : 0);
                    user['token'] = token;
                    user['id'] = results2.insertId;
                    resolve(user);
                    connection.end();
                });
            });
            
        }); 
    });
}

async function groceryList(){
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        await connection.query({
            sql : `select name from grocery`
        }, (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            const finalResults = [];
            results.forEach(e => {
                finalResults.push(name);
            });
            resolve(finalResults);
            connection.end();
        });
    });
}

async function restrictIP(i,ip, cbre){
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        const user = {mobile:i.mobile, tower:i.tower, door:i.door};
        await connection.query({
            sql : `SELECT * FROM daily_grocery WHERE day = ? and tower = ? and door = ?`,
            values : [i.day, i.tower, i.door]
        }, async (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }

            if(results.length !== 0){
                user['token'] = results[0].token;
                user['id'] = results[0].id;
                user['details'] = results[0].data;
                user['alternate'] = results[0].alternate;
                connection.end();
                return resolve(user);
            } 
            if(!cbre){
                await connection.query({
                    sql : `SELECT * FROM daily_grocery WHERE day = ? and ip = ?`,
                    values : [i.day, ip]
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
                    connection.end();
                    return resolve({});
                });
            }
            connection.end();
            return resolve({});
        });
        
    });
    
}

module.exports.bookSlot = bookSlot;
module.exports.lastServed = lastServed;
module.exports.called = called;
module.exports.completed = completed;
module.exports.get = get;
module.exports.bookGrocerySlot = bookGrocerySlot;
module.exports.groceryList = groceryList;
module.exports.restrictIP = restrictIP;