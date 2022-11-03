contract EvilToken {

  function decimals() external view returns (uint8) {
      return 0;
  }

   fallback() payable external {
   }

}
