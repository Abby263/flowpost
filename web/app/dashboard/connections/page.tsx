"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Instagram, Twitter, Linkedin, Trash2, CheckCircle2, Shield, Key, User, Plus, ExternalLink } from "lucide-react";

export default function ConnectionsPage() {
    const { user } = useUser();
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [platform, setPlatform] = useState<"instagram" | "twitter" | "linkedin">("instagram");
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        if (user) {
            fetchConnections();
        }
    }, [user]);

    async function fetchConnections() {
        setLoading(true);
        try {
            const res = await fetch("/api/connections");
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to load connections");
            }
            setConnections(data.connections || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    async function addConnection() {
        if (!user) return;

        let credentials = {};
        let profileName = "";

        if (platform === "instagram") {
            if (!formData.username || !formData.password) {
                alert("Please fill in all fields");
                return;
            }
            credentials = { username: formData.username, password: formData.password };
            profileName = formData.username;
        } else if (platform === "twitter") {
            if (!formData.apiKey || !formData.apiKeySecret || !formData.accessToken || !formData.accessTokenSecret) {
                alert("Please fill in all fields");
                return;
            }
            credentials = {
                apiKey: formData.apiKey,
                apiKeySecret: formData.apiKeySecret,
                accessToken: formData.accessToken,
                accessTokenSecret: formData.accessTokenSecret
            };
            profileName = "Twitter API";
        } else if (platform === "linkedin") {
            if (!formData.accessToken || !formData.personUrn) {
                alert("Please fill in all fields");
                return;
            }
            credentials = {
                accessToken: formData.accessToken,
                personUrn: formData.personUrn,
                organizationId: formData.organizationId
            };
            profileName = formData.personUrn;
        }

        // Check for duplicates
        const isDuplicate = connections.some(
            (c) => c.platform === platform && c.profile_name === profileName
        );

        if (isDuplicate) {
            alert("This connection already exists.");
            return;
        }

        try {
            const res = await fetch("/api/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platform,
                    profile_name: profileName,
                    credentials,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to add connection");
            }
            setConnections([...connections, data.connection]);
            setFormData({});
        } catch (error: any) {
            console.error(error);
            alert(`Failed to add connection: ${error?.message || "Unknown error"}`);
        }
    }

    async function deleteConnection(id: string) {
        try {
            const res = await fetch(`/api/connections?id=${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to delete connection");
            }
            setConnections(connections.filter((c) => c.id !== id));
        } catch (error) {
            console.error(error);
            alert("Failed to delete connection");
        }
    }

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case "instagram": return <Instagram className="h-5 w-5 text-pink-600" />;
            case "twitter": return <Twitter className="h-5 w-5 text-blue-500" />;
            case "linkedin": return <Linkedin className="h-5 w-5 text-blue-700" />;
            default: return null;
        }
    };

    const getPlatformColor = (platform: string) => {
        switch (platform) {
            case "instagram": return "bg-gradient-to-br from-purple-500 to-pink-500";
            case "twitter": return "bg-gradient-to-br from-blue-400 to-blue-600";
            case "linkedin": return "bg-gradient-to-br from-blue-600 to-blue-800";
            default: return "bg-gray-500";
        }
    };

    return (
        <div className="space-y-8 px-6 py-6 max-w-[1400px]">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
                <p className="text-muted-foreground mt-1">
                    Connect your social media accounts to automate content posting.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add New Connection Form */}
                <Card className="lg:col-span-1 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Add New Connection
                        </CardTitle>
                        <CardDescription>
                            Connect a new social media account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="platform" className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Platform
                            </Label>
                            <Select
                                value={platform}
                                onValueChange={(value: any) => {
                                    setPlatform(value);
                                    setFormData({});
                                }}
                            >
                                <SelectTrigger id="platform">
                                    <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="instagram">
                                        <div className="flex items-center gap-2">
                                            <Instagram className="h-4 w-4 text-pink-600" />
                                            Instagram
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="twitter">
                                        <div className="flex items-center gap-2">
                                            <Twitter className="h-4 w-4 text-blue-500" />
                                            Twitter
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="linkedin">
                                        <div className="flex items-center gap-2">
                                            <Linkedin className="h-4 w-4 text-blue-700" />
                                            LinkedIn
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {platform === "instagram" && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        Username
                                    </Label>
                                    <Input
                                        id="username"
                                        name="username"
                                        placeholder="your_username"
                                        value={formData.username || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="flex items-center gap-2">
                                        <Key className="h-4 w-4" />
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        name="password"
                                        placeholder="••••••••"
                                        value={formData.password || ''}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </>
                        )}

                        {platform === "twitter" && (
                            <>
                                <Input name="apiKey" placeholder="API Key" value={formData.apiKey || ''} onChange={handleInputChange} />
                                <Input name="apiKeySecret" type="password" placeholder="API Key Secret" value={formData.apiKeySecret || ''} onChange={handleInputChange} />
                                <Input name="accessToken" placeholder="Access Token" value={formData.accessToken || ''} onChange={handleInputChange} />
                                <Input name="accessTokenSecret" type="password" placeholder="Access Token Secret" value={formData.accessTokenSecret || ''} onChange={handleInputChange} />
                            </>
                        )}

                        {platform === "linkedin" && (
                            <>
                                <Input name="accessToken" type="password" placeholder="Access Token" value={formData.accessToken || ''} onChange={handleInputChange} />
                                <Input name="personUrn" placeholder="Person URN" value={formData.personUrn || ''} onChange={handleInputChange} />
                                <Input name="organizationId" placeholder="Organization ID (Optional)" value={formData.organizationId || ''} onChange={handleInputChange} />
                            </>
                        )}

                        <Button onClick={addConnection} className="w-full">
                            <Plus className="mr-2 h-4 w-4" />
                            Connect Account
                        </Button>
                    </CardContent>
                </Card>

                {/* Your Connections List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Your Connections</h2>
                        <Badge variant="secondary" className="text-sm">
                            {connections.length} {connections.length === 1 ? 'account' : 'accounts'}
                        </Badge>
                    </div>

                    {loading ? (
                        <Card className="p-12">
                            <div className="flex items-center justify-center space-x-3 text-muted-foreground">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                <span>Loading connections...</span>
                            </div>
                        </Card>
                    ) : connections.length === 0 ? (
                        <Card className="p-12 border-2 border-dashed">
                            <div className="text-center">
                                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground text-lg mb-2">No connections yet</p>
                                <p className="text-sm text-muted-foreground">
                                    Connect your first social media account to get started
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {connections.map((conn) => (
                                <Card key={conn.id} className="hover:shadow-md transition-shadow">
                                    <div className="flex items-center p-4 gap-4">
                                        {/* Platform Icon */}
                                        <div className={`w-14 h-14 rounded-xl ${getPlatformColor(conn.platform)} flex items-center justify-center shadow-md shrink-0`}>
                                            <div className="text-white">
                                                {conn.platform === "instagram" && <Instagram className="h-7 w-7" />}
                                                {conn.platform === "twitter" && <Twitter className="h-7 w-7" />}
                                                {conn.platform === "linkedin" && <Linkedin className="h-7 w-7" />}
                                            </div>
                                        </div>

                                        {/* Connection Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold capitalize text-lg">{conn.platform}</h3>
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                    Active
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">
                                                @{conn.profile_name}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => window.open(`https://${conn.platform}.com/${conn.profile_name}`, '_blank')}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => deleteConnection(conn.id)}
                                                className="hover:bg-destructive hover:text-destructive-foreground"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
