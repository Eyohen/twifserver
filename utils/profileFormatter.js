const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CN';

const getLocation = (profile = {}) =>
  [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'Remote';

const getProfileForUser = (user) => {
  if (!user) return null;
  return user.userType === 'business' ? user.businessProfile : user.personalProfile;
};

const getProfileName = (user) => {
  const profile = getProfileForUser(user);

  if (user?.userType === 'business') {
    return profile?.businessName || 'Business profile';
  }

  return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.headline || 'Personal profile';
};

const getProfileType = (user) => {
  const profile = getProfileForUser(user);

  if (user?.userType === 'business') {
    return profile?.businessType || profile?.industry || 'Business';
  }

  return profile?.headline || 'Professional';
};

const getProfileBio = (user) => {
  const profile = getProfileForUser(user);
  return user?.userType === 'business' ? profile?.description : profile?.bio;
};

const getProfileIndustry = (user) => {
  const profile = getProfileForUser(user);
  return user?.userType === 'business' ? profile?.industry : profile?.headline;
};

const formatUserSummary = (user, extras = {}) => {
  const profile = getProfileForUser(user);
  const name = getProfileName(user);

  return {
    userId: user.id,
    accountType: user.userType,
    email: user.email,
    name,
    type: getProfileType(user),
    industry: getProfileIndustry(user) || 'General',
    location: getLocation(profile),
    avatar: getInitials(name),
    bio: getProfileBio(user) || 'No profile summary yet.',
    verified: Boolean(user.verified),
    ...extras,
  };
};

module.exports = {
  formatUserSummary,
  getProfileForUser,
  getProfileName,
};
