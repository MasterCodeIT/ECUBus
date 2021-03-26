/* eslint-disable no-unused-vars */
'use strict';
const fs = require('fs')
const { payload2data, decodeTable } = require('./decode.js')
const elelog = require('electron-log');
const HSE = require('./../../build/Release/HSE.node')
class UDS {
    constructor(win) {
        this.win = win
        this.map = {}
        this.hse = new HSE.HSE()
    }
    emit(channel, msg) {
        if(channel=='udsError'){
            this.error(msg)
        }else if(channel=='udsEnd'){
            this.info(msg)
        }
        this.win.webContents.send(channel, msg)
    }
    progress(show, percent,name='main') {
        this.emit('progress', {
            name: name,
            show: show,
            percent: percent
        })
    }
    set(key, value) {
        this.map[key] = value
    }
    get(key) {
        if (key in this.map)
            return this.map[key]
        else
            return null
    }
    verbose(msg){
        elelog.verbose(JSON.stringify(msg))
    }
    error(msg){
        elelog.error(JSON.stringify(msg))
    }
    info(msg){
        elelog.info(JSON.stringify(msg))
    }
    debug(msg) {
        elelog.debug(JSON.stringify(msg))
    }
    log(msg, type = 'debug') {
        elelog[type](JSON.stringify(msg))
        //this.emit('udsData', JSON.stringify(msg) + '\r\n')
    }
    openFile(filename, flag = 'r') {
        this.fd = fs.openSync(filename, flag)
    }
    readFile(size) {
        var buf = Buffer.alloc(size)
        var len = fs.readSync(this.fd, buf, 0, size)
        return [...buf.slice(0, len)]
    }
    writeFile(data) {
        fs.writeSync(this.fd, Buffer.from(data))
    }
    closeFile() {
        fs.closeSync(this.fd)
    }
    changeNextFrame(name, value = []) {
        if ((this.subTable.length == 0) && (this.udsTable.length > 0)) {
            this.subTable = decodeTable(this.udsTable.shift())
        }
        if (this.subTable.length > 0) {
            for (var i in this.subTable[0].payload) {
                if (this.subTable[0].payload[i].name == name) {
                    this.subTable[0].payload[i][name] = value
                    break
                }
            }
        }
    }
    insertItem(service, payload, func = (writeData, readData) => { return true }) {
        this.subTable.unshift({
            func: func,
            payload: payload,
            service: service
        })
    }
    UDSstart(udsTable) {
        this.udsTable = udsTable
        this.allLen = udsTable.length
        this.subTable = []
    }
    getNextService() {
        if ((this.udsTable.length == 0) && (this.subTable.length == 0)) {
            return null
        }
        if (this.subTable.length == 0) {
            this.subTable = decodeTable(this.udsTable.shift())
        }
        this.tableIndex = this.allLen - this.udsTable.length
        var item = this.subTable.shift()
        var obj = {}
        if (typeof item.func === 'string') {
            try {
                // eslint-disable-next-line no-eval
                obj.checkFunc = eval('(writeData,readData)=>{' + item.func + '}')
            } catch (error) {
                // eslint-disable-next-line no-eval
                throw 'User function syntax error'
            }
        } else {
            obj.checkFunc = item.func
        }
        obj.payload = item.payload
        obj.suppress = false
        for (var i in obj.payload) {
            if (obj.payload[i].type == 'subfunction') {
                if (obj.payload[i].suppress) {
                    obj.suppress = true
                }
                break
            }
        }
        var data = [item.service]
        obj.data = data.concat(payload2data(obj.payload))
        return obj
    }
}



module.exports = UDS;