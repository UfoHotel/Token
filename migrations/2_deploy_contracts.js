const Token = artifacts.require("./UHCToken.sol");

function time(){
    return parseInt(new Date().getTime()/1000)
}

module.exports =  deployer => {
    deployer.deploy(Token, "UHC-Token","UHC",2,1000000)
}
