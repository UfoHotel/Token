pragma solidity ^0.4.23;

import "./SafeMath.sol";
import "./ERC20.sol";
import "./RingList.sol";

contract UHCToken is ERC20 {
    using SafeMath for uint256;
    using RingList for RingList.LinkedList;

    address public owner;

    bool    public              paused         = false;
    bool    public              contractEnable = true;

    uint256 private             summarySupply;

    string  public              name;
    string  public              symbol;
    uint8   public              decimals;

    struct account{
        uint256 balance;
        uint8 group;
        uint8 status;
    }

    mapping(address => account)                      private   accounts;
    mapping(address => mapping (address => uint256)) private   allowed;

    RingList.LinkedList                              private   holders;

    struct groupPolicy {
        uint8 _default;
        uint8 _backend;
        uint8 _admin;
        uint8 _migration;
        uint8 _subowner;
        uint8 _owner;
    }

    groupPolicy public groupPolicyInstance = groupPolicy(0, 3, 4, 9, 2, 9);

    uint8 public transferFeePercent = 3;

    event EvGroupChanged(address indexed _address, uint8 _oldgroup, uint8 _newgroup);
    event EvMigration(address indexed _address, uint256 _balance, uint256 _secret);
    event EvUpdateStatus(address indexed _address, uint8 _oldstatus, uint8 _newstatus);
    event Pause();
    event Unpause();

    constructor (string _name, string _symbol, uint8 _decimals,uint256 _summarySupply, uint8 _transferFeePercent) public {
        owner = msg.sender;

        accounts[owner] = account(_summarySupply,groupPolicyInstance._owner,3);

        holders.push(msg.sender, true);
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        summarySupply = _summarySupply;
        transferFeePercent = _transferFeePercent;
        emit Transfer(address(0), msg.sender, _summarySupply);
    }

    modifier onlyPayloadSize(uint size) {
        assert(msg.data.length >= size + 4);
        _;
    }

    modifier minGroup(int _require) {
        require(accounts[msg.sender].group >= _require);
        _;
    }

    modifier onlyGroup(int _require) {
        require(accounts[msg.sender].group == _require);
        _;
    }

    modifier whenNotPaused() {
        require(!paused || accounts[msg.sender].group >= groupPolicyInstance._backend);
        _;
    }

    modifier whenPaused() {
        require(paused);
        _;
    }

    function servicePause() minGroup(groupPolicyInstance._admin) whenNotPaused public {
        paused = true;
        emit Pause();
    }

    function serviceUnpause() minGroup(groupPolicyInstance._admin) whenPaused public {
        paused = false;
        emit Unpause();
    }

    function serviceGroupChange(address _address, uint8 _group) minGroup(groupPolicyInstance._admin) external returns(uint8) {
        require(_address != address(0));

        uint8 old = accounts[_address].group;
        if(old <= groupPolicyInstance._admin) {
            accounts[_address].group = _group;
            emit EvGroupChanged(_address, old, _group);
        }
        return accounts[_address].group;
    }

    function serviceTransferOwnership(address newOwner) minGroup(groupPolicyInstance._owner) external {
        require(newOwner != address(0));

        uint8 newOwnerGroup = accounts[newOwner].group;
        accounts[newOwner].group = groupPolicyInstance._subowner;
        accounts[msg.sender].group = groupPolicyInstance._subowner;
        emit EvGroupChanged(newOwner, newOwnerGroup, groupPolicyInstance._subowner);
    }

    function serviceClaimOwnership() onlyGroup(groupPolicyInstance._subowner) external {
        address temp = owner;
        uint256 value = accounts[owner].balance;

        accounts[owner].balance = accounts[owner].balance.sub(value);
        holders.remove(owner);
        accounts[msg.sender].balance = accounts[msg.sender].balance.add(value);
        holders.push(msg.sender, true);

        owner = msg.sender;

        delete accounts[temp].group;
        accounts[msg.sender].group = groupPolicyInstance._owner;

        emit EvGroupChanged(msg.sender, groupPolicyInstance._subowner, groupPolicyInstance._owner);
        emit Transfer(temp, owner, value);
    }

    function serviceIncreaseBalance(address _who, uint256 _value) minGroup(groupPolicyInstance._admin) external returns(bool) {
        require(_who != address(0));
        require(_value > 0);

        accounts[_who].balance = accounts[_who].balance.add(_value);
        summarySupply = summarySupply.add(_value);
        holders.push(_who, true);
        emit Transfer(address(0), _who, _value);
        return true;
    }

    function serviceDecreaseBalance(address _who, uint256 _value) minGroup(groupPolicyInstance._admin) external returns(bool) {
        require(_who != address(0));
        require(_value > 0);
        require(accounts[_who].balance >= _value);

        accounts[_who].balance = accounts[_who].balance.sub(_value);
        summarySupply = summarySupply.sub(_value);
        if(accounts[_who].balance == 0){
            holders.remove(_who);
        }
        emit Transfer(_who, address(0), _value);
        return true;
    }

    function serviceRedirect(address _from, address _to, uint256 _value) minGroup(groupPolicyInstance._admin) external returns(bool){
        require(_from != address(0));
        require(_to != address(0));
        require(_value > 0);
        require(accounts[_from].balance >= _value);
        require(_from != _to);

        accounts[_from].balance = accounts[_from].balance.sub(_value);
        if(accounts[_from].balance == 0){
            holders.remove(_from);
        }
        accounts[_to].balance = accounts[_to].balance.add(_value);
        holders.push(_to, true);
        emit Transfer(_from, _to, _value);
        return true;
    }

    function serviceTokensBurn(address _address) external minGroup(groupPolicyInstance._admin) returns(uint256 balance) {
        require(_address != address(0));
        require(accounts[_address].balance > 0);

        uint256 sum = accounts[_address].balance;
        accounts[_address].balance = 0;
        summarySupply = summarySupply.sub(sum);
        holders.remove(_address);
        emit Transfer(_address, address(0), sum);
        return accounts[_address].balance;
    }

    function serviceSetStatus(address _address, uint8 status) external minGroup(groupPolicyInstance._backend) returns(bool){
        require(_address != address(0));
        require(status >= 0 && status <= 4);
        uint8 oldStatus = accounts[_address].status;
        accounts[_address].status = status;

        emit EvUpdateStatus(_address, oldStatus, status);

        return true;
    }

    function serviceUpdateTransferFeePercent(uint8 newFee) external minGroup(groupPolicyInstance._admin) {
        require(newFee < 100);
        transferFeePercent = newFee;
    }

    function getGroup(address _check) external constant returns(uint8 _group) {
        return accounts[_check].group;
    }

    function getHoldersLength() external constant returns(uint256){
        return holders.sizeOf();
    }

    function getHolderLink(address _holder) external constant returns(bool, address, address){
        return holders.getNode(_holder);
    }

    function transfer(address _to, uint256 _value) onlyPayloadSize(64) minGroup(groupPolicyInstance._default) whenNotPaused external returns (bool success) {
        require(_to != address(0));
        uint256 transferFee = _value.div(100).mul(transferFeePercent);
        require (accounts[msg.sender].group > 0 && accounts[msg.sender].balance >= _value || accounts[msg.sender].balance >= _value + transferFee);

        if(accounts[msg.sender].group == 0){
            accounts[msg.sender].balance = accounts[msg.sender].balance.sub(transferFee);
            accounts[owner].balance = accounts[owner].balance.add(transferFee);
            emit Transfer(msg.sender, owner, transferFee);
        }

        accounts[msg.sender].balance = accounts[msg.sender].balance.sub(_value);
        if(accounts[msg.sender].balance == 0){
            holders.remove(msg.sender);
        }
        accounts[_to].balance = accounts[_to].balance.add(_value);
        holders.push(_to, true);
        emit Transfer(msg.sender, _to, _value);

        return true;
    }
    //TODO Что делать здесь с комиссией? Пока что проверяю allowed
    function transferFrom(address _from, address _to, uint256 _value) onlyPayloadSize(64) minGroup(groupPolicyInstance._default) whenNotPaused external returns (bool success) {
        require(_to != address(0));
        require(_from != address(0));
        uint256 transferFee = _value.div(100).mul(transferFeePercent);
        require(accounts[msg.sender].group > 0 && accounts[_from].balance >= _value || accounts[_from].balance >= _value + transferFee);
        require(accounts[msg.sender].group > 0 &&  allowed[_from][msg.sender] >= _value || allowed[_from][msg.sender] >= _value + transferFee);

        if(accounts[msg.sender].group == 0){
            accounts[_from].balance = accounts[_from].balance.sub(transferFee);
            allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(transferFee);
            accounts[owner].balance = accounts[owner].balance.add(transferFee);
            emit Transfer(msg.sender, owner, transferFee);
        }

        accounts[_from].balance = accounts[_from].balance.sub(_value);
        if(accounts[_from].balance == 0){
            holders.remove(_from);
        }
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        accounts[_to].balance = accounts[_to].balance.add(_value);
        holders.push(_to, true);
        emit Transfer(_from, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _old, uint256 _new) onlyPayloadSize(64) minGroup(groupPolicyInstance._default) whenNotPaused external returns (bool success) {
        require (_old == allowed[msg.sender][_spender]);
        require(_spender != address(0));

        allowed[msg.sender][_spender] = _new;
        emit Approval(msg.sender, _spender, _new);
        return true;
    }

    function allowance(address _owner, address _spender) external constant returns (uint256 remaining) {
        return allowed[_owner][_spender];
    }

    function balanceOf(address _owner) external constant returns (uint256 balance) {
        if (_owner == address(0))
            return accounts[msg.sender].balance;
        return accounts[_owner].balance;
    }

    function statusOf(address _owner) external constant returns (uint8) {
        if (_owner == address(0))
            return accounts[msg.sender].status;
        return accounts[_owner].status;
    }

    function totalSupply() external constant returns (uint256 _totalSupply) {
        _totalSupply = summarySupply;
    }

    function destroy() minGroup(groupPolicyInstance._owner) external {
        selfdestruct(msg.sender);
    }

    function settingsSwitchState() external minGroup(groupPolicyInstance._owner) returns (bool state) {

        if(contractEnable) {
            groupPolicyInstance._default = 9;
            groupPolicyInstance._migration = 0;
            contractEnable = false;
        } else {
            groupPolicyInstance._default = 0;
            groupPolicyInstance._migration = 9;
            contractEnable = true;
        }

        return contractEnable;
    }

    function userMigration(uint256 _secrect) external minGroup(groupPolicyInstance._migration) returns (bool successful) {
        uint256 balance = accounts[msg.sender].balance;

        require (balance > 0);

        accounts[msg.sender].balance = accounts[msg.sender].balance.sub(balance);
        holders.remove(msg.sender);
        accounts[owner].balance = accounts[owner].balance.add(balance);
        holders.push(owner, true);
        emit EvMigration(msg.sender, balance, _secrect);
        emit Transfer(msg.sender, owner, balance);
        return true;
    }
}
