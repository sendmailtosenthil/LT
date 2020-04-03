const mysql      = require('mysql');
const dbConfig = {
    host     : 'localhost',
    user     : 'root',
    password : 'MyNewPass',
    database : 'lt'
  };

  async function bookSlot(day, mobile, tower, door){
    
    return new Promise(async (resolve, reject) => {
        let connection = mysql.createConnection(dbConfig);          
        connection.connect();
        const user = {mobile, tower, door};
        await connection.query({
            sql : `SELECT * FROM veggie WHERE day = ? and mobile = ? and tower = ? and door = ?`,
            values : [day, mobile, tower, door]
        }, async (error, results) => {
            if(error){
                console.log(error);
                connection.end();
                return reject(error);
            }
            if(results.length === 0){
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
                        sql : `insert into veggie(day,mobile,tower,door,token) values (?,?,?,?,?)`,
                        values : [day, mobile, tower, door, token]
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
                user['token'] = results[0].token;
                user['id'] = results[0].id;
                resolve(user);
                connection.end();
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

async function called(day, id, token, val){
    
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

async function completed(day, id, token, val){
    
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