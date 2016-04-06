var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

describe('Test: security controller - profiles', function () {
  var
    kuzzle,
    error;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        // Mock
        kuzzle.repositories.role.roles.role1 = { _id: 'role1' };
        kuzzle.repositories.profile.validateAndSaveProfile = profile => {
          if (profile._id === 'alreadyExists') {
            return q.reject();
          }

          return q(profile);
        };
        kuzzle.repositories.profile.loadProfile = id => {
          var profileId;

          if (id instanceof Profile) {
            profileId = id._id;
          }
          else {
            profileId = id;
          }

          if (profileId === 'badId') {
            return q(null);
          }

          return q({
            _index: kuzzle.config.internalIndex,
            _type: 'profiles',
            _id: profileId,
            roles: [{
              _id: 'role1',
              controllers: {}
            }]
          });
        };
        kuzzle.services.list.readEngine.search = () => {
          if (error) {
            return q.reject(new Error(''));
          }

          return q({
            hits: [{_id: 'test'}],
            total: 1
          });
        };

        kuzzle.repositories.profile.loadMultiFromDatabase = (ids, hydrate) => {
          if (error) {
            return q.reject(new Error(''));
          }

          if (!hydrate) {
            return q(ids.map(id => {
              return {
                _id: id,
                _source: {
                  roles: [{_id: 'role1'}]
                }
              };
            }));
          }

          return q(ids.map(id => {
            return {
              _id: id,
              roles: [{_id: 'role1'}]
            };
          }));
        };

        kuzzle.repositories.profile.deleteProfile = () => {
          if (error) {
            return q.reject(new Error(''));
          }
          return q({_id: 'test'});
        };
      });
  });

  beforeEach(() => {
    error = false;
  });

  describe('#createOrReplaceProfile', function () {
    it('should resolve to a responseObject on a createOrReplaceProfile call', () => {
      return kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
          body: {_id: 'test', roles: [{_id: 'role1'}]}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.security.createOrReplaceProfile(new RequestObject({
        body: {_id: 'alreadyExists' }
      }))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#createProfile', function () {
    it('should reject when a profile already exists with the id', () => {
      var promise = kuzzle.funnel.controllers.security.createProfile(new RequestObject({
          body: {_id: 'alreadyExists', roles: [{_id: 'role1'}]}
        }));

      return should(promise).be.rejected();
    });

    it('should resolve to a responseObject on a createProfile call', () => {
      var promise = kuzzle.funnel.controllers.security.createProfile(new RequestObject({
        body: {_id: 'test', roles: [{_id: 'role1'}]}
      }));

      return should(promise).be.fulfilled();
    });
  });

  describe('#getProfile', function () {
    it('should resolve to a responseObject on a getProfile call', done => {
      kuzzle.funnel.controllers.security.getProfile(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body._id).be.exactly('test');
          done();
        })
        .catch(error => {
          done(error);
        });
    });

    it('should reject to an error on a getProfile call without id', () => {
      return should(kuzzle.funnel.controllers.security.getProfile(new RequestObject({body: {_id: ''}}))).be.rejectedWith(ResponseObject);
    });

    it('should reject NotFoundError on a getProfile call with a bad id', () => {
      return should(kuzzle.funnel.controllers.security.getProfile(new RequestObject({body: {_id: 'badId'}}))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#mGetProfiles', function () {
    it('should reject to an error on a mGetProfiles call without ids', () => {
      return should(kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({body: {}}))).be.rejectedWith(ResponseObject);
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
        body: {ids: ['test'] }
      }))).be.rejectedWith(ResponseObject);
    });

    it('should resolve to a responseObject on a mGetProfiles call', () => {
      return kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
          body: {ids: ['test']}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();

          should(result.data.body.hits[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles).be.an.Array();
          should(result.data.body.hits[0]._source.roles[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles[0]._id).be.an.String();
        });
    });

    it('should resolve to a responseObject with roles on a mGetProfiles call with hydrate', () => {
      return kuzzle.funnel.controllers.security.mGetProfiles(new RequestObject({
          body: {ids: ['test'], hydrate: true}
        }))
        .then(result => {
          should(result).be.an.instanceOf(ResponseObject);
          should(result.data.body.hits).be.an.Array();
          should(result.data.body.hits).not.be.empty();
          should(result.data.body.hits[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles).be.an.Array();
          should(result.data.body.hits[0]._source.roles[0]).be.an.Object();
          should(result.data.body.hits[0]._source.roles[0]._id).be.a.String();
        });
    });
  });

  describe('#searchProfiles', function () {
    it('should return a ResponseObject containing an array of profiles on searchProfile call', () => {
      return kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
          body: {}
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');
        });
    });

    it('should return a ResponseObject containing an array of profiles on searchProfile call with hydrate', () => {
      return kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
          body: {
            roles: ['role1'],
            hydrate: true
          }
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result.hits).be.an.Array();
          should(jsonResponse.result.hits[0]._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.security.searchProfiles(new RequestObject({
        body: {roles: ['foo']}
      }))).be.rejectedWith(ResponseObject);
    });
  });

  describe('#updateProfile', function () {
    it('should return a valid ResponseObject', () => {
      kuzzle.repositories.profile.validateAndSaveProfile = profile => {
        return q(profile);
      };

      return kuzzle.funnel.controllers.security.updateProfile(new RequestObject({
          body: { _id: 'test', foo: 'bar' }
        }), {})
        .then(response => {
          should(response).be.an.instanceOf(ResponseObject);
          should(response.data.body._id).be.exactly('test');
        });
    });

    it('should reject the promise if no id is given', () => {
      return should(kuzzle.funnel.controllers.security.updateProfile(new RequestObject({
        body: {}
      }), {}))
        .be.rejectedWith(ResponseObject);
    });
  });

  describe('#deleteProfile', function () {
    it('should return response with on deleteProfile call', () => {
      return kuzzle.funnel.controllers.security.deleteProfile(new RequestObject({
          body: {_id: 'test'}
        }))
        .then(result => {
          var jsonResponse = result.toJson();

          should(result).be.an.instanceOf(ResponseObject);
          should(jsonResponse.result._id).be.exactly('test');
        });
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.security.deleteProfile(new RequestObject({
        body: {_id: 'test'}
      }))).be.rejectedWith(ResponseObject);
    });
  });
});
