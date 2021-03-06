"use strict";
var Promise = require("bluebird");
var test = require("../util/test");
var env = test.mkEnv();
var config = env.config;

describe("Provisioning API", function() {
    var mxUser = {
        id: "@flibble:wibble",
        nick: "M-flibble"
    };

    var ircUser = {
        nick: "bob",
        localpart: config._server + "_bob",
        id: "@" + config._server + "_bob:" + config.homeserver.domain
    };

    // Create a coroutine to test certain API parameters.
    //  parameters {object} - the API parameters
    //  shouldSucceed {boolean} - true if the request should succeed
    //  link {boolean} - true if this is a link request (false if unlink)
    let mockLink = function (parameters, shouldSucceed, link) {

        return test.coroutine(function*() {
            let json = jasmine.createSpy("json(obj)")
            .andCallFake(function(obj) {
                console.log('JSON ' + JSON.stringify(obj))
            });
            let status = jasmine.createSpy("status(num)")
            .andCallFake(function(number) {
                console.log(`HTTP STATUS ${number}`)
            });

            // Defaults
            if (!parameters.matrix_room_id) {
                parameters.matrix_room_id = "!foo:bar";
            }
            if (!parameters.remote_room_server) {
                parameters.remote_room_server = "irc.example";
            }
            if (!parameters.remote_room_channel) {
                parameters.remote_room_channel = "#provisionedchannel";
            }

            // When the _link promise resolves...
            let resolve = function () {
                if (shouldSucceed) {
                    // success is indicated with empty object
                    expect(json).toHaveBeenCalledWith({});
                }
                else {
                    // but it should not have resolved
                    return Promise.reject('Expected to fail');
                }
            };

            // When the _link fails
            let reject = function (err) {
                if (shouldSucceed) {
                    // but it should have succeeded
                    return Promise.reject(err);
                }
                // and it should have failed
                expect(err).toBeDefined();
                expect(status).toHaveBeenCalledWith(500);
                expect(json).toHaveBeenCalled();
                // Make sure the first call to JSON has error defined
                expect(json.calls[0].args[0].error).toBeDefined();
            };

            // Unlink needs an existing link to remove, so add one first
            // but only if it should succeed. If it should fail due to
            // validation, there does not need to be an existing link
            if (shouldSucceed && !link) {
                return env.mockAppService._link(
                   parameters, status, json
                ).then(() => {
                    return env.mockAppService._unlink(
                       parameters, status, json
                    ).then(resolve, reject);
                });
            }

            if (link) {
                return env.mockAppService._link(
                   parameters, status, json
                ).then(resolve, reject);
            }
            return env.mockAppService._unlink(
               parameters, status, json
            ).then(resolve, reject);
        });
    };

    describe("room setup", function() {
        beforeEach(function(done) {
            test.beforeEach(this, env); // eslint-disable-line no-invalid-this

            // accept connection requests from eeeeeeeeveryone!
            env.ircMock._autoConnectNetworks(
                config._server, mxUser.nick, config._server
            );
            env.ircMock._autoConnectNetworks(
                config._server, ircUser.nick, config._server
            );
            env.ircMock._autoConnectNetworks(
                config._server, config._botnick, config._server
            );
            // accept join requests from eeeeeeeeveryone!
            env.ircMock._autoJoinChannels(
                config._server, mxUser.nick, config._chan
            );
            env.ircMock._autoJoinChannels(
                config._server, ircUser.nick, config._chan
            );
            env.ircMock._autoJoinChannels(
                config._server, config._botnick, config._chan
            );

            // do the init
            test.initEnv(env).done(function() {
                done();
            });
        });

        describe("link endpoint", function() {

            it("should create a M<--->I link",
                mockLink({}, true, true));

            it("should not create a M<--->I link with the same id as one existing",
                mockLink({
                    matrix_room_id : '!foo:bar',
                    remote_room_server : 'irc.example',
                    remote_room_channel : '#coffee'}, false, true));

            it("should not create a M<--->I link when room_id is malformed",
                mockLink({matrix_room_id : '!fooooooo'}, false, true));

            it("should not create a M<--->I link when remote_room_server is malformed",
                mockLink({remote_room_server : 'irc./example'}, false, true));

            it("should not create a M<--->I link when remote_room_channel is malformed",
                mockLink({remote_room_channel : 'coffe####e'}, false, true));
        });

        describe("unlink endpoint", function() {
            it("should remove an existing M<--->I link",
                mockLink({}, true, false));

            it("should not remove a non-existing M<--->I link",
                mockLink({matrix_room_id : '!idonot:exist'}, false, false));

            it("should not remove a non-provision M<--->I link",
                mockLink({
                    matrix_room_id : '!foo:bar',
                    remote_room_server : 'irc.example',
                    remote_room_channel : '#coffee'}, false, false));

            it("should not remove a M<--->I link when room_id is malformed",
                mockLink({matrix_room_id : '!fooooooooo'}, false, false));

            it("should not remove a M<--->I link when remote_room_server is malformed",
                mockLink({remote_room_server : 'irc./example'}, false, false));

            it("should not remove a M<--->I link when remote_room_channel is malformed",
                mockLink({remote_room_channel : 'coffe####e'}, false, false));
        });
    });

    describe("with config links existing", function() {
        beforeEach(function(done) {
            config.ircService
                .servers[config._server]
                .mappings['#provisionedchannel'] = ['!foo:bar'];

            test.beforeEach(this, env); // eslint-disable-line no-invalid-this

            // accept connection requests from eeeeeeeeveryone!
            env.ircMock._autoConnectNetworks(
                config._server, mxUser.nick, config._server
            );
            env.ircMock._autoConnectNetworks(
                config._server, ircUser.nick, config._server
            );
            env.ircMock._autoConnectNetworks(
                config._server, config._botnick, config._server
            );
            // accept join requests from eeeeeeeeveryone!
            env.ircMock._autoJoinChannels(
                config._server, mxUser.nick, config._chan
            );
            env.ircMock._autoJoinChannels(
                config._server, ircUser.nick, config._chan
            );
            env.ircMock._autoJoinChannels(
                config._server, config._botnick, config._chan
            );

            // do the init
            test.initEnv(env).done(function() {
                done();
            });
        });

        it("should not create a M<--->I link of the same link id",
            mockLink({}, false, true)
        );
    });

    describe("message sending and joining", function() {
        beforeEach(function(done) {
            config.ircService.servers[config._server].mappings = {};
            test.beforeEach(this, env); // eslint-disable-line no-invalid-this

            // Ignore bot connecting
            env.ircMock._autoConnectNetworks(
                config._server, config._botnick, config._server
            );

            // do the init
            test.initEnv(env).done(function() {
                done();
            });
        });

        it("should allow IRC to send messages via the new link",
            test.coroutine(function*() {

                let json = jasmine.createSpy("json(obj)");
                let status = jasmine.createSpy("status(num)");

                let parameters = {
                    matrix_room_id : "!foo:bar",
                    remote_room_server : "irc.example",
                    remote_room_channel : "#provisionedchannel"
                };

                let roomMapping = {
                    roomId : parameters.matrix_room_id,
                    server : parameters.remote_room_server,
                    channel : parameters.remote_room_channel
                };

                let nickForDisplayName = mxUser.nick;

                var gotConnectCall = false;
                env.ircMock._whenClient(roomMapping.server, nickForDisplayName, "connect",
                function(client, cb) {
                    gotConnectCall = true;
                    client._invokeCallback(cb);
                });

                var gotJoinCall = false;
                env.ircMock._whenClient(roomMapping.server, nickForDisplayName, "join",
                function(client, channel, cb) {
                    gotJoinCall = true;
                    client._invokeCallback(cb);
                });

                var gotSayCall = false;
                env.ircMock._whenClient(roomMapping.server, nickForDisplayName, "say",
                function(client, channel, text) {
                    expect(client.nick).toEqual(nickForDisplayName);
                    expect(client.addr).toEqual(roomMapping.server);
                    expect(channel).toEqual(roomMapping.channel);
                    gotSayCall = true;
                });

                return env.mockAppService._linkAction(
                   parameters, status, json, true
                ).then(
                    () => {
                        return env.mockAppService._trigger("type:m.room.message", {
                            content: {
                                body: "A message",
                                msgtype: "m.text"
                            },
                            user_id: mxUser.id,
                            room_id: roomMapping.roomId,
                            type: "m.room.message"
                        }).then(function() {
                            expect(gotConnectCall).toBe(
                                true, nickForDisplayName + " failed to connect to IRC."
                            );
                            expect(gotJoinCall).toBe(
                                true, nickForDisplayName + " failed to join IRC channel."
                            );
                            expect(gotSayCall).toBe(true, "Didn't get say");
                        })
                });
            })
        );


        it("should not allow IRC to send messages following unlink",
            test.coroutine(function*() {

                let json = jasmine.createSpy("json(obj)");
                let status = jasmine.createSpy("status(num)");

                let parameters = {
                    matrix_room_id : "!foo:bar",
                    remote_room_server : "irc.example",
                    remote_room_channel : "#provisionedchannel"
                };

                let roomMapping = {
                    roomId : parameters.matrix_room_id,
                    server : parameters.remote_room_server,
                    channel : parameters.remote_room_channel
                };

                let nickForDisplayName = mxUser.nick;

                var gotConnectCall = false;
                env.ircMock._whenClient(roomMapping.server, nickForDisplayName, "connect",
                function(client, cb) {
                    gotConnectCall = true;
                    client._invokeCallback(cb);
                });

                var gotJoinCall = false;
                env.ircMock._whenClient(roomMapping.server, nickForDisplayName, "join",
                function(client, channel, cb) {
                    gotJoinCall = true;
                    client._invokeCallback(cb);
                });

                var countSays = 0;
                env.ircMock._whenClient(roomMapping.server, nickForDisplayName, "say",
                function(client, channel, text) {
                    expect(client.nick).toEqual(nickForDisplayName);
                    expect(client.addr).toEqual(roomMapping.server);
                    expect(channel).toEqual(roomMapping.channel);
                    countSays++;
                });

                return env.mockAppService._linkAction(parameters, status, json, true)
                    .then(() => {
                        return env.mockAppService._trigger("type:m.room.message", {
                            content: {
                                body: "First message",
                                msgtype: "m.text"
                            },
                            user_id: mxUser.id,
                            room_id: roomMapping.roomId,
                            type: "m.room.message"
                    }).then(() => {
                        return env.mockAppService._linkAction(parameters, status, json, false)
                        .then(() => {
                                return env.mockAppService._trigger("type:m.room.message", {
                                    content: {
                                        body: "This message should not be sent",
                                        msgtype: "m.text"
                                    },
                                    user_id: mxUser.id,
                                    room_id: roomMapping.roomId,
                                    type: "m.room.message"
                                }).then(() => {
                                    expect(gotConnectCall).toBe(
                                        true, nickForDisplayName + " failed to connect to IRC."
                                    );
                                    expect(gotJoinCall).toBe(
                                        true, nickForDisplayName + " failed to join IRC channel."
                                    );
                                    expect(countSays).toBe(
                                        1, "Should have only sent one message"
                                    );
                                })
                            }
                        )
                    })
                });
            })
        );
    });
});
