pragma solidity ^0.4.23;

import "./SafeMath.sol";
import "./UHCToken.sol";

contract EtherReceiver {

    using SafeMath for uint256;

    uint256 public      startTime;
    uint256 public      durationOfStatusSell;
    uint256 public      weiPerMinToken;
    uint256 public      softcap;
    uint256 public      totalSold;
    uint8   public      referalBonusPercent;
    uint8   public      refererFeePercent;

    mapping(uint256 => uint256) public      soldOnVersion;
    mapping(address => uint8)   private     group;

    uint256 public     version;
    uint256 public      etherTotal;//Total ether on current contract version

    bool    public     isActive = false;
    
    struct Account{
        uint256 spent;
        uint256 allTokens;
        uint256 statusTokens;
        uint256 version;
        address referer;
    }

    mapping(address => Account) public accounts;

    struct groupPolicy {
        uint8 _backend;
        uint8 _admin;
    }

    groupPolicy public groupPolicyInstance = groupPolicy(3,4);

    uint256[4] public statusMinBorders; //example: [24999, 99999, 349999, 1299999]

    UHCToken public            token;

    event EvAccountPurchase(address indexed _address, uint256 _newspent, uint256 _newtokens, uint256 _totalsold);
    event EvWithdraw(address indexed _address, uint256 _spent);
    event EvSwitchActivate(address indexed _switcher, bool _isActivate);
    event EvSellStatusToken(address indexed _owner, uint256 _oldtokens, uint256 _newtokens);
    event EvUpdateVersion(address indexed _owner, uint256 _version);
    event EvGroupChanged(address _address, uint8 _oldgroup, uint8 _newgroup);

    constructor (address _token,uint256 _startTime, uint256 _weiPerMinToken, uint256 _softcap,uint256 _durationOfStatusSell,uint[4] _statusMinBorders, uint8 _referalBonusPercent, uint8 _refererFeePercent, bool _activate) public{
        token = UHCToken(_token);
        startTime = _startTime;
        weiPerMinToken = _weiPerMinToken;
        softcap = _softcap;
        durationOfStatusSell = _durationOfStatusSell;
        statusMinBorders = _statusMinBorders;
        referalBonusPercent = _referalBonusPercent;
        refererFeePercent = _refererFeePercent;
        isActive = _activate;
        group[msg.sender] = groupPolicyInstance._admin;
    }

    modifier onlyOwner(){
        require(msg.sender == token.owner());
        _;
    }

    modifier saleIsOn() {
        require(now > startTime && isActive && soldOnVersion[version] < softcap);
        _;
    }

    modifier minGroup(int _require) {
        require(group[msg.sender] >= _require || msg.sender == token.owner());
        _;
    }

    function refresh(uint256 _startTime, uint256 _softcap,uint256 _durationOfStatusSell,uint[4] _statusMinBorders, uint8 _referalBonusPercent, uint8 _refererFeePercent, bool _activate) external minGroup(groupPolicyInstance._admin) {
        require(!isActive &&  etherTotal == 0);
        startTime = _startTime;
        softcap = _softcap;
        durationOfStatusSell = _durationOfStatusSell;
        statusMinBorders = _statusMinBorders;
        referalBonusPercent = _referalBonusPercent;
        refererFeePercent = _refererFeePercent;
        version = version.add(1);
        isActive = _activate;
        emit EvUpdateVersion(msg.sender, version);
    }

    function transfer(address _to, uint256 _value) external minGroup(groupPolicyInstance._backend) saleIsOn() {
        token.transfer( _to, _value);

        updateAccountInfo(msg.sender, 0, _value);

        address referer = token.refererOf(_to);
        if(referer != address(0)) {
            uint256 refererFee = _value.div(100).mul(refererFeePercent);
            uint256 referalBonus = _value.div(100).mul(referalBonusPercent);

            if(refererFee > 0) {
                token.backendSendBonus(referer, refererFee);
            }
            if(referalBonus > 0) {
                token.backendSendBonus(msg.sender, referalBonus);
            }
        }
    }

    function getWei() external minGroup(groupPolicyInstance._admin) returns(bool success) {
        //Если контракт закончился и достигли целевых продаж
        require(!isActive && soldOnVersion[version] >= softcap);
        uint256 contractBalance = address(this).balance;
        token.owner().transfer(contractBalance);
        etherTotal = 0;

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
        require(!isActive && soldOnVersion[version] < softcap);

        tryUpdateVersion(msg.sender);

        require(accounts[msg.sender].spent > 0);

        uint value = accounts[msg.sender].spent;
        accounts[msg.sender].spent = 0;
        etherTotal = etherTotal.sub(value);
        msg.sender.transfer(value);

        emit EvWithdraw(msg.sender, value);
    }

    function serviceGroupChange(address _address, uint8 _group) minGroup(groupPolicyInstance._admin) external returns(uint8) {
        uint8 old = group[_address];
        if(old <= groupPolicyInstance._admin) {
            group[_address] = _group;
            emit EvGroupChanged(_address, old, _group);
        }
        return group[_address];
    }

    function () external saleIsOn() payable{
        uint256 tokenCount = msg.value.div(weiPerMinToken);
        require(tokenCount > 0);

        token.transfer( msg.sender, tokenCount);

        updateAccountInfo(msg.sender, msg.value, tokenCount);

        address referer = token.refererOf(msg.sender);
        if (msg.data.length == 20 && referer == address(0)) {
            referer = bytesToAddress(bytes(msg.data));
            require(referer != msg.sender);
            require(token.backendSetReferer(msg.sender, referer));
        }
        if(referer != address(0)) {
            uint256 refererFee = tokenCount.div(100).mul(refererFeePercent);
            uint256 referalBonus = tokenCount.div(100).mul(referalBonusPercent);
            if(refererFee > 0) {
                token.backendSendBonus(referer, refererFee);
            }
            if(referalBonus > 0) {
                token.backendSendBonus(msg.sender, referalBonus);
            }
        }
    }

    function updateAccountInfo(address _address, uint256 incSpent, uint256 incTokenCount) private returns(bool){
        tryUpdateVersion(_address);
        accounts[_address].spent = accounts[_address].spent.add(incSpent);
        accounts[_address].allTokens = accounts[_address].allTokens.add(incTokenCount);

        totalSold = totalSold.add(incTokenCount);
        soldOnVersion[version] = soldOnVersion[version].add(incTokenCount);
        etherTotal = etherTotal.add(incSpent);

        emit EvAccountPurchase(_address, accounts[_address].spent, accounts[_address].allTokens, totalSold);

        if(now < startTime + durationOfStatusSell && now >= startTime){

            uint256 lastStatusTokens = accounts[_address].statusTokens;

            accounts[_address].statusTokens = lastStatusTokens.add(incTokenCount);

            uint256 currentStatus = uint256(token.statusOf(_address));

            uint256 newStatus = currentStatus;

            for(uint256 i = currentStatus; i < 4; i++){

                if(accounts[_address].statusTokens > statusMinBorders[i]){
                    newStatus = i + 1;
                } else {
                    break;
                }
            }
            if(currentStatus < newStatus){
                token.backendSetStatus(_address, uint8(newStatus));
            }
            emit EvSellStatusToken(_address, lastStatusTokens, accounts[_address].statusTokens );
        }

        return true;
    }

    function tryUpdateVersion(address _address) private {
        if(accounts[_address].version != version){
            accounts[_address].spent = 0;
            accounts[_address].version = version;
        }
    }

    function bytesToAddress(bytes bys) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys,20))
        }
    }

    function calculateTokenCount(uint256 weiAmount) external constant returns(uint256 summary){
        return weiAmount.div(weiPerMinToken);
    }

    function isSelling() external constant returns(bool){
        return now > startTime && soldOnVersion[version] < softcap && isActive;
    }

    function getGroup(address _check) external constant returns(uint8 _group) {
        return group[_check];
    }
}