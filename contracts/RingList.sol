pragma solidity ^0.4.23;

library RingList {

    address constant NULL = 0x0;
    address constant HEAD = 0x0;
    bool constant PREV = false;
    bool constant NEXT = true;

    struct LinkedList{
        mapping (address => mapping (bool => address)) list;
    }

    function listExists(LinkedList storage self)
    internal
    view returns (bool)
    {
        // if the head nodes previous or next pointers both point to itself, then there are no items in the list
        if (self.list[HEAD][PREV] != HEAD || self.list[HEAD][NEXT] != HEAD) {
            return true;
        } else {
            return false;
        }
    }

    function nodeExists(LinkedList storage self, address _node)
    internal
    view returns (bool)
    {
        if (self.list[_node][PREV] == HEAD && self.list[_node][NEXT] == HEAD) {
            if (self.list[HEAD][NEXT] == _node) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    }

    function sizeOf(LinkedList storage self) internal view returns (uint256 numElements) {
        bool exists;
        address i;
        (exists,i) = getAdjacent(self, HEAD, NEXT);
        while (i != HEAD) {
            (exists,i) = getAdjacent(self, i, NEXT);
            numElements++;
        }
        return;
    }

    function getNode(LinkedList storage self, address _node)
    internal view returns (bool, address, address)
    {
        if (!nodeExists(self,_node)) {
            return (false,0x0,0x0);
        } else {
            return (true,self.list[_node][PREV], self.list[_node][NEXT]);
        }
    }

    function getAdjacent(LinkedList storage self, address _node, bool _direction)
    internal view returns (bool, address)
    {
        if (!nodeExists(self,_node)) {
            return (false,0x0);
        } else {
            return (true,self.list[_node][_direction]);
        }
    }

    function getSortedSpot(LinkedList storage self, address _node, address _value, bool _direction)
    internal view returns (address)
    {
        if (sizeOf(self) == 0) { return 0x0; }
        require((_node == 0x0) || nodeExists(self,_node));
        bool exists;
        address next;
        (exists,next) = getAdjacent(self, _node, _direction);
        while  ((next != 0x0) && (_value != next) && ((_value < next) != _direction)) next = self.list[next][_direction];
        return next;
    }

    function createLink(LinkedList storage self, address _node, address _link, bool _direction) internal  {
        self.list[_link][!_direction] = _node;
        self.list[_node][_direction] = _link;
    }

    function insert(LinkedList storage self, address _node, address _new, bool _direction) internal returns (bool) {
        if(!nodeExists(self,_new) && nodeExists(self,_node)) {
            address c = self.list[_node][_direction];
            createLink(self, _node, _new, _direction);
            createLink(self, _new, c, _direction);
            return true;
        } else {
            return false;
        }
    }

    function remove(LinkedList storage self, address _node) internal returns (address) {
        if ((_node == NULL) || (!nodeExists(self,_node))) { return 0x0; }
        createLink(self, self.list[_node][PREV], self.list[_node][NEXT], NEXT);
        delete self.list[_node][PREV];
        delete self.list[_node][NEXT];
        return _node;
    }

    function push(LinkedList storage self, address _node, bool _direction) internal  {
        insert(self, HEAD, _node, _direction);
    }

    function pop(LinkedList storage self, bool _direction) internal returns (address) {
        bool exists;
        address adj;

        (exists,adj) = getAdjacent(self, HEAD, _direction);

        return remove(self, adj);
    }
}
