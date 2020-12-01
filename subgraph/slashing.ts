// import { UserSlashed } from '../generated/schema';
// import { UserSlashed as UserSlashedEvent } from '../generated/Pool-4/RewardCampaign';

// export function userSlashed(event: UserSlashed): void {
//   let userSlashed = new UserSlashed(event.transaction.hash.toHexString());
//   userSlashed.contractAddress = event.address;
//   userSlashed.slasher = event.params._slasher;
//   userSlashed.user = event.params._user;
//   userSlashed.amount = event.params._amount;
//   userSlashed.save();
// }
