pragma solidity ^0.4.23;

import "./SafeMath.sol";
import "./UHCToken.sol";
import "./GroupManager.sol";

contract EtherReceiver is GroupManager{

    using SafeMath for uint256;

    uint256 public      startTime;
    uint256 public      durationOfStatusSell;
    uint256 public      weiPerMinToken;
    uint256 public      softcap;
    uint256 public      totalSold;

    mapping(uint256 => uint256) public      soldOnVersion;
    mapping(uint256 => uint256) public      etherOnVersion;

    uint256 public     version;

    bool    public     isActive = false;
    
    struct Account{
        uint256 spent;
        uint256 allTokens;
        uint256 statusTokens;
        uint256 version;
    }

    mapping(address => Account) public accounts;

    uint256[4] public statusMinBorders; //example: [24999, 99999, 349999, 1299999]

    UHCToken public            token;

    event EvAccountPurchase(address indexed _address, uint256 _newspent, uint256 _newtokens, uint256 _totalsold);
    event EvWithdraw(address indexed _address, uint256 _spent);
    event EvSwitchActivate(address indexed _switcher, bool _isActivate);
    event EvSellStatusToken(address indexed _owner, uint256 _oldtokens, uint256 _newtokens);
    event EvUpdateStatus(address indexed _owner, uint256 _oldstatus, uint256 _newstatus);

    constructor (address _token,uint256 _startTime, uint256 _weiPerMinToken, uint256 _softcap,uint256 _durationOfStatusSell,uint[4] _statusMinBorders, bool _activate) public{
        token = UHCToken(_token);
        startTime = _startTime;
        weiPerMinToken = _weiPerMinToken;
        softcap = _softcap;
        durationOfStatusSell = _durationOfStatusSell;
        statusMinBorders = _statusMinBorders;
        isActive = _activate;
    }

    modifier onlyOwner(){
        require(msg.sender == token.owner());
        _;
    }

    modifier saleIsOn() {
        require(now > startTime && isActive && soldOnVersion[version] < softcap);
        _;
    }
    //После вызова, все данные о трате эфира будут удалены
    function refresh(uint256 _startTime, uint256 _softcap,uint256 _durationOfStatusSell,uint[4] _statusMinBorders, bool _activate) external minGroup(groupPolicyInstance._admin) {
        //Если контракт кончился и либо достигли целевых продаж, либо всем инвесторам были возвращены средства
        require(!isActive && (soldOnVersion[version] >= softcap || etherOnVersion[version] == 0));
        startTime = _startTime;
        softcap = _softcap;
        durationOfStatusSell = _durationOfStatusSell;
        statusMinBorders = _statusMinBorders;
        version = version.add(1);
        isActive = _activate;
    }

    function transfer(address _to, uint256 _value) external minGroup(groupPolicyInstance._backend) saleIsOn() {
        token.transfer( _to, _value);

        updateAccountInfo(msg.sender, 0, _value);
    }

    function getWei() external minGroup(groupPolicyInstance._admin) returns(bool success) {
        //Если контракт закончился и достигли целевых продаж
        require(!isActive && soldOnVersion[version] >= softcap);
        uint256 contractBalance = address(this).balance;
        token.owner().transfer(contractBalance);

        return true;
    }

    function switchActivate() external minGroup(groupPolicyInstance._admin) {
        isActive = !isActive;
        emit EvSwitchActivate(msg.sender, isActive);
    }

    function setWeiPerMinToken(uint256 _weiPerMinToken) external minGroup(groupPolicyInstance._backend)  {
        require (_weiPerMinToken > 0);

        weiPerMinToken = _weiPerMinToken;
    }

    function destroy() external onlyOwner() {
        selfdestruct(token.owner());
    }

    function withdraw() external {
        //Если контракт закончился и не достигли целевых продаж
        require(!isActive && soldOnVersion[version] < softcap);

        tryUpdateVersion(msg.sender);

        require(accounts[msg.sender].spent > 0);

        uint value = accounts[msg.sender].spent;
        accounts[msg.sender].spent = 0;
        etherOnVersion[version] = etherOnVersion[version].sub(value);
        msg.sender.transfer(value);

        emit EvWithdraw(msg.sender, value);
    }

    function updateAccountInfo(address _address, uint256 incSpent, uint256 incTokenCount) private returns(bool){
        //Пытаемя обновить версию аккаунта
        tryUpdateVersion(_address);
        //Увеличиваем суммарные затраты инвестора
        accounts[_address].spent = accounts[_address].spent.add(incSpent);
        //Увеличиваем суммарные токены инвестора
        accounts[_address].allTokens = accounts[_address].allTokens.add(incTokenCount);

        //Увеличиваем суммарную продажу токенов
        totalSold = totalSold.add(incTokenCount);
        //Увеличиваем суммарную продажу токенов за версию
        soldOnVersion[version] = soldOnVersion[version].add(incTokenCount);
        //Увеличиваем суммарные затраты инвесторов за версию
        etherOnVersion[version] = etherOnVersion[version].add(incSpent);

        //Событие новой покупки
        emit EvAccountPurchase(_address, accounts[_address].spent, accounts[_address].allTokens, totalSold);
        //Проверяем что за эту покупку можем обновить статус инвестора
        if(now < startTime + durationOfStatusSell && now >=startTime){
            //Суммарные токены в период статуса
            uint256 lastStatusTokens = accounts[_address].statusTokens;
            //Увеличиваем суммарные токены в период статуса
            accounts[_address].statusTokens = lastStatusTokens.add(incTokenCount);
            //Узнаем текущий статус
            uint256 currentStatus = uint256(token.statusOf(_address));
            //Переменная для нового статуса
            uint256 newStatus = currentStatus;
            //Проходимся по границам выше текущего статуса
            for(uint256 i = currentStatus; i < 4; i++){
                //Если токенов больше чем на текущей границе
                if(accounts[_address].statusTokens > statusMinBorders[i]){
                    //Увеличиваем новый статус
                    newStatus = i + 1;
                } else {
                    //Останавливаем цикл
                    break;
                }
            }
            //Если новый статус больше старого
            if(currentStatus < newStatus){
                //Меняем статус
                token.serviceSetStatus(_address, uint8(newStatus));
                //Вызываем событие обновления статуса
                emit EvUpdateStatus(_address, currentStatus, newStatus);
            }
            //Вызываем событие покупки статусных токенов
            emit EvSellStatusToken(_address, lastStatusTokens, accounts[_address].statusTokens );
        }

        return true;
    }
    //Пытается обновить версию аккаунта, если была обновлена версия контракта
    //Обнуляется только внесенный эфир,  приобретенное кол-во токенов суммируется с остальными версиями
    function tryUpdateVersion(address _address) private {
        if(accounts[_address].version != version){
            accounts[_address].spent = 0;
            accounts[_address].version = version;
        }
    }

    function () external saleIsOn() payable{
        uint256 tokenCount = msg.value.div(weiPerMinToken);
        require(tokenCount > 0);

        token.transfer( msg.sender, tokenCount);

        updateAccountInfo(msg.sender, msg.value, tokenCount);
    }

    function calculateTokenCount(uint256 weiAmount) external constant returns(uint256 summary){
        return weiAmount.div(weiPerMinToken);
    }

    function isSelling() external constant returns(bool){
        return now > startTime && soldOnVersion[version] < softcap && isActive;
    }
}