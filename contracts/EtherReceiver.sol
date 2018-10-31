pragma solidity ^0.4.24;

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
    uint256 public      etherTotal;

    bool    public     isActive = false;

    uint8   public      giftPercent;
    bool    public      isGiftActive;

    bool    public      isBulkImportEnabled;
    
    struct Account{
        uint256 spent;
        uint256 allTokens;
        uint256 statusTokens;
        uint256 version;
        uint256 versionTokens;
        uint256 versionStatusTokens;
        uint256 versionRefererTokens;
        uint8 versionBeforeStatus;
    }

    mapping(address => Account) public accounts;

    struct groupPolicy {
        uint8 _backend;
        uint8 _admin;
    }

    groupPolicy public groupPolicyInstance = groupPolicy(3,4);

    uint256[4] public statusMinBorders;

    UHCToken public            token;

    event EvAccountPurchase(address indexed _address, uint256 _newspent, uint256 _newtokens, uint256 _totalsold);
    event EvSwitchActivate(address indexed _switcher, bool _isActivate);
    event EvSellStatusToken(address indexed _owner, uint256 _oldtokens, uint256 _newtokens);
    event EvUpdateVersion(address indexed _owner, uint256 _version);
    event EvGroupChanged(address _address, uint8 _oldgroup, uint8 _newgroup);

    constructor (
        address _token,
        uint256 _startTime,
        uint256 _weiPerMinToken, 
        uint256 _softcap,
        uint256 _durationOfStatusSell,
        uint[4] _statusMinBorders, 
        uint8 _referalBonusPercent, 
        uint8 _refererFeePercent,
        bool _activate
    ) public
    {
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
        isBulkImportEnabled = true;
    }

    modifier onlyOwner(){
        require(msg.sender == token.owner());
        _;
    }

    modifier saleIsOn() {
        require(now > startTime && isActive && soldOnVersion[version] < softcap && !isBulkImportEnabled);
        _;
    }

    modifier minGroup(int _require) {
        require(group[msg.sender] >= _require || msg.sender == token.owner());
        _;
    }

    function refresh(
        uint256 _startTime, 
        uint256 _softcap,
        uint256 _durationOfStatusSell,
        uint[4] _statusMinBorders,
        uint8 _referalBonusPercent, 
        uint8 _refererFeePercent,
        bool _activate
    ) 
        external
        minGroup(groupPolicyInstance._admin) 
    {
        require(!isActive && etherTotal == 0);
        startTime = _startTime;
        softcap = _softcap;
        durationOfStatusSell = _durationOfStatusSell;
        statusMinBorders = _statusMinBorders;
        referalBonusPercent = _referalBonusPercent;
        refererFeePercent = _refererFeePercent;
        version = version.add(1);
        isActive = _activate;

        giftPercent = 0;
        isGiftActive = false;

        emit EvUpdateVersion(msg.sender, version);
    }

    function transfer(address _to, uint256 _value) external minGroup(groupPolicyInstance._backend) saleIsOn() {
        token.transfer( _to, _value);

        updateAccountInfo(_to, 0, _value);

        address referer = token.refererOf(_to);
        trySendBonuses(_to, referer, _value);
    }

    function withdraw() external minGroup(groupPolicyInstance._admin) returns(bool success) {
        require(!isActive);
        uint256 contractBalance = address(this).balance;
        token.owner().transfer(contractBalance);
        etherTotal = 0;

        return true;
    }

    function activateVersion(bool _isActive) external minGroup(groupPolicyInstance._admin) {
        require(isActive != _isActive);
        isActive = _isActive;
        emit EvSwitchActivate(msg.sender, isActive);
    }

    function setWeiPerMinToken(uint256 _weiPerMinToken) external minGroup(groupPolicyInstance._backend)  {
        require (_weiPerMinToken > 0);

        weiPerMinToken = _weiPerMinToken;
    }

    function serviceGroupChange(address _address, uint8 _group) minGroup(groupPolicyInstance._admin) external returns(uint8) {
        uint8 old = group[_address];
        if(old <= groupPolicyInstance._admin) {
            group[_address] = _group;
            emit EvGroupChanged(_address, old, _group);
        }
        return group[_address];
    }

    function serviceActivateGift(uint8 _giftPercent) external minGroup(groupPolicyInstance._admin) returns(bool) {
        giftPercent = _giftPercent;
        isGiftActive = true;
        return true;
    }

    function serviceDeactivateGift() external minGroup(groupPolicyInstance._admin) returns(bool) {
        giftPercent = 0;
        isGiftActive = false;
        return true;
    }

    function bulkImport(address[] investors, uint256[] weiSpent) external minGroup(groupPolicyInstance._admin) payable {
        require(isBulkImportEnabled);
        uint256 totalWei = msg.value;
        for(uint256 index = 0; index < investors.length; index++) {
            require(totalWei >= weiSpent[index]);
            accounts[investors[index]].spent = weiSpent[index];
            etherTotal = etherTotal.add(weiSpent[index]);
            totalWei = totalWei.sub(weiSpent[index]);
        }
    }

    function finishBulkImport() external minGroup(groupPolicyInstance._admin) {
        isBulkImportEnabled = false;
    }

    function () external saleIsOn() payable{
        uint256 tokenCount = msg.value.div(weiPerMinToken);
        require(tokenCount > 0);

        token.transfer( msg.sender, tokenCount);

        updateAccountInfo(msg.sender, msg.value, tokenCount);

        address referer = token.refererOf(msg.sender);
        if (msg.data.length > 0 && referer == address(0)) {
            referer = token.getPromoAddress(bytes(msg.data));
            if(referer != address(0)) {
                require(referer != msg.sender);
                require(token.backendSetReferer(msg.sender, referer));
            }
        }
        trySendBonuses(msg.sender, referer, tokenCount);
    }

    function updateAccountInfo(address _address, uint256 incSpent, uint256 incTokenCount) private returns(bool){
        tryUpdateVersion(_address);
        Account storage account = accounts[_address];
        account.spent = account.spent.add(incSpent);
        account.allTokens = account.allTokens.add(incTokenCount);
        
        account.versionTokens = account.versionTokens.add(incTokenCount);
        
        totalSold = totalSold.add(incTokenCount);
        soldOnVersion[version] = soldOnVersion[version].add(incTokenCount);
        etherTotal = etherTotal.add(incSpent);

        emit EvAccountPurchase(_address, account.spent.sub(1), account.allTokens, totalSold);

        if(now < startTime + durationOfStatusSell && now >= startTime){

            uint256 lastStatusTokens = account.statusTokens;

            account.statusTokens = account.statusTokens.add(incTokenCount);
            account.versionStatusTokens = account.versionStatusTokens.add(incTokenCount);

            uint256 currentStatus = uint256(token.statusOf(_address));

            uint256 newStatus = currentStatus;

            for(uint256 i = currentStatus; i < 4; i++){

                if(account.statusTokens > statusMinBorders[i]){
                    newStatus = i + 1;
                } else {
                    break;
                }
            }
            if(currentStatus < newStatus){
                token.backendSetStatus(_address, uint8(newStatus));
            }
            emit EvSellStatusToken(_address, lastStatusTokens, account.statusTokens);
        }

        return true;
    }

    function tryUpdateVersion(address _address) private {
        Account storage account = accounts[_address];
        if(account.version != version){
            account.version = version;
            account.versionBeforeStatus = token.statusOf(_address);
        }
        if(account.version != version || account.spent == 0){
            account.spent = 1;
            account.versionTokens = 1;
            account.versionRefererTokens = 1;
            account.versionStatusTokens = 1;
        }
    }

    function trySendBonuses(address _address, address _referer, uint256 _tokenCount) private {
        uint256 accountBonus = 0;
        if(isGiftActive && giftPercent > 0) {
            uint256 giftTokens = _tokenCount.div(100).mul(giftPercent);
            accountBonus = accountBonus.add(giftTokens);
        }
        if(_referer != address(0)) {
            uint256 refererFee = _tokenCount.div(100).mul(refererFeePercent);
            uint256 referalBonus = _tokenCount.div(100).mul(referalBonusPercent);
            if(refererFee > 0) {
                token.backendSendBonus(_referer, refererFee);
                
                accounts[_address].versionRefererTokens = accounts[_address].versionRefererTokens.add(refererFee);
                
            }
            if(referalBonus > 0) {
                accountBonus = accountBonus.add(referalBonus);
            }
        }
        if(accountBonus > 0) {
            token.backendSendBonus(_address, accountBonus);
            accounts[_address].versionTokens = accounts[_address].versionTokens.add(accountBonus);
            accounts[_address].allTokens = accounts[_address].allTokens.add(accountBonus);
        }
    }

    function calculateTokenCount(uint256 weiAmount) external view returns(uint256 summary){
        return weiAmount.div(weiPerMinToken);
    }

    function isSelling() external view returns(bool){
        return now > startTime && soldOnVersion[version] < softcap && isActive;
    }

    function getGroup(address _check) external view returns(uint8 _group) {
        return group[_check];
    }
}