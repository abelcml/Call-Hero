import type { Scenario } from './types';

// 8 demo samples for Harbour Home Services (Sydney). All phone numbers are fictional.
export const scenarios: Scenario[] = [
  {
    id: 'leaking-tap',
    label: 'Leaking tap booking',
    channel: 'call',
    text: "Hi, yeah, um, it's Sarah Mitchell here. I've got a leaking tap in the kitchen, it's been dripping for like a week now and it's getting worse. I'm at 14 Elizabeth Street in Rosebery. Ah, could someone come out Thursday afternoon maybe, after two? My number's 0400 000 123. Thanks, bye.",
    expectDecision: 'auto',
    expectIntent: 'booking',
  },
  {
    id: 'after-hours',
    label: 'After-hours booking',
    channel: 'call',
    text: "Hello, uh, sorry, I know it's late, I'm calling at 7:40pm and I can hear your office is closed, but I just wanted to leave a message. It's Tom Nguyen. I need a power point fixed in my bedroom in Newtown, it's cracked and doesn't hold the plug. 32 King Street, Newtown. Any time Saturday morning would be great. You can ring me on 0400 000 218. Cheers.",
    expectDecision: 'auto',
    expectIntent: 'booking',
  },
  {
    id: 'burst-pipe',
    label: 'Burst pipe emergency',
    channel: 'call',
    text: "Hi, please, I need help right now! A pipe has burst in the bathroom upstairs and there's water coming through the ceiling into the lounge room, it's going everywhere! I don't know where the mains is. I'm at, uh, 7 Hunter Street, Parramatta. Please someone come as soon as possible. It's Priya, 0400 000 342.",
    expectDecision: 'human',
    expectIntent: 'emergency',
  },
  {
    id: 'gas-smell',
    label: 'Gas smell emergency',
    channel: 'call',
    text: "Hey, um, I can smell gas in my kitchen, like a strong rotten egg smell, it started about ten minutes ago near the stove. I've opened the windows. Should I be, like, worried? I'm in Bondi, on Campbell Parade, I'll give you the number in a sec, it's 0400 000 476. Can someone come check it out today please?",
    expectDecision: 'human',
    expectIntent: 'emergency',
  },
  {
    id: 'angry-refund',
    label: 'Angry refund request',
    channel: 'call',
    text: "Yeah, hi, this is Mark Dawson. I'm really not happy. Your plumber came to my place in Marrickville last Tuesday, charged me four hundred and eighty dollars, and the toilet is still leaking! He was in and out in twenty minutes and didn't even clean up. This is ridiculous. I want a full refund and I want to speak to a manager. Call me on 0400 000 589.",
    expectDecision: 'human',
    expectIntent: 'complaint',
  },
  {
    id: 'vague-callback',
    label: 'Vague callback request',
    channel: 'call',
    text: "Hi, um, yeah, can someone call me back please? Uh, yeah. It's about, um, it's a bit hard to explain. Just, yeah, call me back. Thanks.",
    expectDecision: 'human',
    expectIntent: 'other', // very little information: an LLM would reasonably pick 'other' with low confidence => escalate
  },
  {
    id: 'service-area',
    label: 'Service area & hours',
    channel: 'message',
    text: "Hi there, do you guys service Chatswood and the lower north shore? And what are your opening hours, are you open on weekends? Just trying to work out who to call for a few odd jobs around the house. Thanks!",
    expectDecision: 'auto',
    expectIntent: 'inquiry',
  },
  {
    id: 'mandarin-aircon',
    label: '中文预约 Chinese booking',
    channel: 'message',
    text: "你好，我想预约安装一个空调，卧室用的，已经买好了。我叫王丽，住在Chatswood，Victoria Avenue 88号，公寓 12B。这周六上午方便的话最好。我的电话是 0400 000 731，谢谢！",
    expectDecision: 'auto',
    expectIntent: 'booking',
  },
];
